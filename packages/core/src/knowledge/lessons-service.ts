/**
 * LessonsService — 写作教训自学习系统
 *
 * 流程:
 *   1. 明镜审校发现 MAJOR/CRITICAL 问题 → 自动创建 pending 候选
 *   2. 用户在 WebUI 确认 → status='active'
 *   3. 写作时按相关性查询 active lessons → 装配到执笔上下文
 *   4. 每章写作后更新触发计数 + 过期淘汰检查
 */

import { createLogger } from "../logger/index.js";
import type {
  Lesson,
  LessonFilter,
  LessonStatus,
  CreateLessonInput,
} from "./types.js";
import { DEFAULT_LESSON_EXPIRY_THRESHOLD } from "./types.js";

const logger = createLogger("lessons-service");

/**
 * 抽象 Lessons 存储接口
 */
export interface LessonStore {
  findById(id: string): Promise<Lesson | null>;
  findMany(filter: LessonFilter): Promise<Lesson[]>;
  findActive(projectId: string): Promise<Lesson[]>;
  findPending(projectId: string): Promise<Lesson[]>;
  create(input: CreateLessonInput): Promise<Lesson>;
  updateStatus(id: string, status: LessonStatus): Promise<Lesson>;
  updateTrigger(id: string, chapterNumber: number, triggerCount: number): Promise<Lesson>;
  incrementInactive(ids: string[]): Promise<void>;
  resetInactive(ids: string[]): Promise<void>;
  archiveExpired(projectId: string, threshold: number): Promise<number>;
  delete(id: string): Promise<void>;
}

export class LessonsService {
  constructor(private readonly store: LessonStore) {}

  /**
   * 从审校结果创建 lesson 候选
   * 只有 MAJOR 和 CRITICAL 级别的问题才会创建候选
   */
  async createFromReview(input: CreateLessonInput): Promise<Lesson> {
    if (input.severity !== "critical" && input.severity !== "major") {
      throw new Error(`Only MAJOR/CRITICAL issues can become lessons, got: ${input.severity}`);
    }
    const lesson = await this.store.create(input);
    logger.info(
      { id: lesson.id, severity: lesson.severity, sourceChapter: lesson.sourceChapter },
      "Lesson candidate created from review",
    );
    return lesson;
  }

  /**
   * 用户确认 lesson 候选 → active
   */
  async approve(id: string): Promise<Lesson> {
    const lesson = await this.store.findById(id);
    if (!lesson) throw new Error(`Lesson not found: ${id}`);
    if (lesson.status !== "pending") {
      throw new Error(`Cannot approve lesson with status: ${lesson.status}`);
    }
    const updated = await this.store.updateStatus(id, "active");
    logger.info({ id }, "Lesson approved");
    return updated;
  }

  /**
   * 用户拒绝 lesson 候选 → cancelled
   */
  async reject(id: string): Promise<Lesson> {
    const lesson = await this.store.findById(id);
    if (!lesson) throw new Error(`Lesson not found: ${id}`);
    if (lesson.status !== "pending") {
      throw new Error(`Cannot reject lesson with status: ${lesson.status}`);
    }
    const updated = await this.store.updateStatus(id, "cancelled");
    logger.info({ id }, "Lesson rejected");
    return updated;
  }

  /**
   * 手动归档 lesson → archived
   */
  async archive(id: string): Promise<Lesson> {
    const lesson = await this.store.findById(id);
    if (!lesson) throw new Error(`Lesson not found: ${id}`);
    const updated = await this.store.updateStatus(id, "archived");
    logger.info({ id }, "Lesson archived");
    return updated;
  }

  /**
   * 获取项目所有待确认 lessons
   */
  async getPending(projectId: string): Promise<Lesson[]> {
    return this.store.findPending(projectId);
  }

  /**
   * 获取项目所有活跃 lessons
   */
  async getActive(projectId: string): Promise<Lesson[]> {
    return this.store.findActive(projectId);
  }

  /**
   * 按过滤条件查询 lessons
   */
  async list(filter: LessonFilter): Promise<Lesson[]> {
    return this.store.findMany(filter);
  }

  /**
   * 获取与当前章节相关的 active lessons
   *
   * 匹配策略:
   *   1. issueType 匹配章节类型（如 'ai_flavor' 对所有章节都相关）
   *   2. tags 与章节标签有交集
   *   3. 无 tags 的 lessons 视为通用（总是加载）
   */
  async getRelevantLessons(
    projectId: string,
    chapterTags: string[] = [],
  ): Promise<Lesson[]> {
    const activeLessons = await this.store.findActive(projectId);

    if (chapterTags.length === 0) {
      return activeLessons; // no tags to filter by, return all active
    }

    const chapterTagSet = new Set(chapterTags.map((t) => t.toLowerCase()));

    return activeLessons.filter((lesson) => {
      // Universal lessons (no tags) always match
      if (!lesson.tags || lesson.tags.length === 0) return true;

      // Tag intersection check
      return lesson.tags.some((tag) => chapterTagSet.has(tag.toLowerCase()));
    });
  }

  /**
   * 记录 lesson 被触发（章节写作时使用了此 lesson）
   */
  async recordTrigger(id: string, chapterNumber: number): Promise<Lesson> {
    const lesson = await this.store.findById(id);
    if (!lesson) throw new Error(`Lesson not found: ${id}`);

    const updated = await this.store.updateTrigger(
      id,
      chapterNumber,
      lesson.triggerCount + 1,
    );
    // Reset inactive counter since it was just used
    await this.store.resetInactive([id]);
    return updated;
  }

  /**
   * 章节完成后更新 lessons 状态
   *
   * 对于本次未被触发的 active lessons:
   *   - inactiveChapters + 1
   *   - 超过 expiryThreshold → 自动 archived
   */
  async onChapterCompleted(
    projectId: string,
    triggeredLessonIds: string[],
  ): Promise<{ archived: number }> {
    const activeLessons = await this.store.findActive(projectId);
    const triggeredSet = new Set(triggeredLessonIds);

    // Lessons not triggered this chapter
    const untriggeredIds = activeLessons
      .filter((l) => !triggeredSet.has(l.id))
      .map((l) => l.id);

    if (untriggeredIds.length > 0) {
      await this.store.incrementInactive(untriggeredIds);
    }

    // Reset inactive for triggered lessons
    if (triggeredLessonIds.length > 0) {
      await this.store.resetInactive(triggeredLessonIds);
    }

    // Expire stale lessons
    const archived = await this.store.archiveExpired(projectId, DEFAULT_LESSON_EXPIRY_THRESHOLD);
    if (archived > 0) {
      logger.info({ projectId, archived }, "Lessons auto-archived due to inactivity");
    }

    return { archived };
  }

  /**
   * 获取单条 lesson
   */
  async getById(id: string): Promise<Lesson | null> {
    return this.store.findById(id);
  }

  /**
   * 删除 lesson（仅用户可操作）
   */
  async delete(id: string): Promise<void> {
    await this.store.delete(id);
    logger.info({ id }, "Lesson deleted");
  }
}
