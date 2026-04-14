import { describe, it, expect, beforeEach } from "vitest";
import { KnowledgeService } from "../knowledge-service.js";
import { LessonsService } from "../lessons-service.js";
import { KnowledgeLoader } from "../knowledge-loader.js";
import { InMemoryKnowledgeStore, InMemoryLessonStore } from "../in-memory-store.js";
import { getDefaultKnowledgeEntries, DEFAULT_KNOWLEDGE_ENTRIES } from "../seed.js";
import {
  AGENT_KNOWLEDGE_BUDGETS,
  DEFAULT_LESSON_EXPIRY_THRESHOLD,
  MAX_ENTRY_TOKENS,
} from "../types.js";

// ── KnowledgeService Tests ──────────────────────────────

describe("KnowledgeService", () => {
  let store: InMemoryKnowledgeStore;
  let service: KnowledgeService;

  beforeEach(() => {
    store = new InMemoryKnowledgeStore();
    service = new KnowledgeService(store);
  });

  it("创建知识库条目", async () => {
    const entry = await service.create({
      scope: "global",
      category: "writing_craft",
      title: "测试条目",
      content: "这是一条测试知识",
      tags: ["test"],
      consumers: ["执笔"],
    });
    expect(entry.id).toBeDefined();
    expect(entry.scope).toBe("global");
    expect(entry.category).toBe("writing_craft");
    expect(entry.version).toBe(1);
  });

  it("按ID获取条目", async () => {
    const created = await service.create({
      scope: "global",
      category: "genre",
      content: "仙侠知识",
    });
    const found = await service.getById(created.id);
    expect(found).not.toBeNull();
    expect(found?.content).toBe("仙侠知识");
  });

  it("按scope查询条目列表", async () => {
    await service.create({ scope: "global", category: "writing_craft", content: "全局A" });
    await service.create({ scope: "global", category: "genre", content: "全局B" });
    await service.create({ scope: "project:123", category: "writing_craft", content: "项目C" });

    const globalEntries = await service.listByScope("global");
    expect(globalEntries).toHaveLength(2);

    const projectEntries = await service.listByScope("project:123");
    expect(projectEntries).toHaveLength(1);
  });

  it("按filter查询条目", async () => {
    await service.create({ scope: "global", category: "writing_craft", content: "A", tags: ["tag1"] });
    await service.create({ scope: "global", category: "genre", content: "B", tags: ["tag2"] });
    await service.create({ scope: "global", category: "writing_craft", content: "C", tags: ["tag1", "tag2"] });

    const result = await service.list({ category: "writing_craft" });
    expect(result).toHaveLength(2);
  });

  it("按consumer查询条目", async () => {
    await service.create({ scope: "global", category: "writing_craft", content: "A", consumers: ["执笔", "明镜"] });
    await service.create({ scope: "global", category: "reference", content: "B", consumers: ["匠心"] });
    await service.create({ scope: "project:123", category: "reference", content: "C", consumers: ["执笔"] });

    const forWriter = await service.listForConsumer("执笔", "123");
    expect(forWriter).toHaveLength(2);

    const forDesigner = await service.listForConsumer("匠心", "123");
    expect(forDesigner).toHaveLength(1);
  });

  it("更新条目并自动版本归档", async () => {
    const entry = await service.create({
      scope: "global",
      category: "writing_craft",
      content: "原始内容",
    });

    const updated = await service.update(entry.id, {
      content: "更新后的内容",
      updatedBy: "user",
    });

    expect(updated.version).toBe(2);
    expect(updated.content).toBe("更新后的内容");

    const versions = await service.getVersionHistory(entry.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.content).toBe("原始内容");
    expect(versions[0]?.version).toBe(1);
  });

  it("多次更新生成多个版本", async () => {
    const entry = await service.create({
      scope: "global",
      category: "writing_craft",
      content: "v1",
    });

    await service.update(entry.id, { content: "v2", updatedBy: "user" });
    await service.update(entry.id, { content: "v3", updatedBy: "agent" });

    const current = await service.getById(entry.id);
    expect(current?.version).toBe(3);

    const versions = await service.getVersionHistory(entry.id);
    expect(versions).toHaveLength(2);
  });

  it("获取指定版本", async () => {
    const entry = await service.create({
      scope: "global",
      category: "writing_craft",
      content: "版本1内容",
    });
    await service.update(entry.id, { content: "版本2内容" });

    const v1 = await service.getVersion(entry.id, 1);
    expect(v1?.content).toBe("版本1内容");
  });

  it("删除条目", async () => {
    const entry = await service.create({
      scope: "global",
      category: "genre",
      content: "即将删除",
    });

    await service.delete(entry.id);
    const found = await service.getById(entry.id);
    expect(found).toBeNull();
  });

  it("更新不存在的条目抛出错误", async () => {
    await expect(
      service.update("nonexistent", { content: "test" }),
    ).rejects.toThrow("Knowledge entry not found");
  });

  it("升级项目级条目为全局", async () => {
    const entry = await service.create({
      scope: "project:abc",
      category: "reference",
      content: "项目级知识",
    });

    const promoted = await service.promoteToGlobal(entry.id);
    expect(promoted.version).toBe(2);

    // Version history should record the promotion
    const versions = await service.getVersionHistory(entry.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.updatedBy).toBe("system:promote");
  });

  it("全局条目重复升级无影响", async () => {
    const entry = await service.create({
      scope: "global",
      category: "writing_craft",
      content: "已经是全局",
    });

    const result = await service.promoteToGlobal(entry.id);
    expect(result.version).toBe(1); // no change
  });
});

// ── LessonsService Tests ────────────────────────────────

describe("LessonsService", () => {
  let store: InMemoryLessonStore;
  let service: LessonsService;
  const projectId = "project-test-001";

  beforeEach(() => {
    store = new InMemoryLessonStore();
    service = new LessonsService(store);
  });

  it("从审校创建lesson候选", async () => {
    const lesson = await service.createFromReview({
      projectId,
      severity: "major",
      title: "过多使用'缓缓'",
      description: "执笔在第3章连续使用了5次'缓缓'，属于AI味标记词",
      sourceChapter: 3,
      sourceAgent: "mingjing",
      issueType: "ai_flavor",
      tags: ["anti-ai", "word-choice"],
    });
    expect(lesson.status).toBe("pending");
    expect(lesson.severity).toBe("major");
    expect(lesson.triggerCount).toBe(0);
  });

  it("只接受MAJOR/CRITICAL创建lesson", async () => {
    await expect(
      service.createFromReview({
        projectId,
        severity: "minor",
        title: "小问题",
        description: "无关紧要",
      }),
    ).rejects.toThrow("Only MAJOR/CRITICAL");
  });

  it("用户确认lesson → active", async () => {
    const lesson = await service.createFromReview({
      projectId,
      severity: "critical",
      title: "测试",
      description: "测试",
    });

    const approved = await service.approve(lesson.id);
    expect(approved.status).toBe("active");
  });

  it("用户拒绝lesson → cancelled", async () => {
    const lesson = await service.createFromReview({
      projectId,
      severity: "major",
      title: "测试",
      description: "测试",
    });

    const rejected = await service.reject(lesson.id);
    expect(rejected.status).toBe("cancelled");
  });

  it("不能对非pending lesson执行approve/reject", async () => {
    const lesson = await service.createFromReview({
      projectId,
      severity: "major",
      title: "测试",
      description: "测试",
    });
    await service.approve(lesson.id);

    await expect(service.approve(lesson.id)).rejects.toThrow("Cannot approve");
    await expect(service.reject(lesson.id)).rejects.toThrow("Cannot reject");
  });

  it("获取pending和active lessons", async () => {
    const l1 = await service.createFromReview({ projectId, severity: "major", title: "L1", description: "D1" });
    const l2 = await service.createFromReview({ projectId, severity: "major", title: "L2", description: "D2" });
    await service.createFromReview({ projectId, severity: "critical", title: "L3", description: "D3" });

    await service.approve(l1.id);
    await service.approve(l2.id);

    const pending = await service.getPending(projectId);
    expect(pending).toHaveLength(1);

    const active = await service.getActive(projectId);
    expect(active).toHaveLength(2);
  });

  it("按相关性获取lessons（tags匹配）", async () => {
    const l1 = await service.createFromReview({
      projectId, severity: "major",
      title: "AI味", description: "...", tags: ["anti-ai"],
    });
    const l2 = await service.createFromReview({
      projectId, severity: "major",
      title: "节奏", description: "...", tags: ["pacing"],
    });
    const l3 = await service.createFromReview({
      projectId, severity: "major",
      title: "通用", description: "无tags",
    });

    await service.approve(l1.id);
    await service.approve(l2.id);
    await service.approve(l3.id);

    const relevant = await service.getRelevantLessons(projectId, ["anti-ai"]);
    expect(relevant).toHaveLength(2); // l1 (tag match) + l3 (no tags = universal)
  });

  it("无chapterTags时返回所有active", async () => {
    const l1 = await service.createFromReview({
      projectId, severity: "major", title: "A", description: "...", tags: ["tag1"],
    });
    await service.approve(l1.id);

    const all = await service.getRelevantLessons(projectId);
    expect(all).toHaveLength(1);
  });

  it("记录lesson触发", async () => {
    const lesson = await service.createFromReview({
      projectId, severity: "major", title: "T", description: "D",
    });
    await service.approve(lesson.id);

    const triggered = await service.recordTrigger(lesson.id, 5);
    expect(triggered.triggerCount).toBe(1);
    expect(triggered.lastTriggeredChapter).toBe(5);
  });

  it("章节完成后更新inactive计数", async () => {
    const l1 = await service.createFromReview({ projectId, severity: "major", title: "L1", description: "D1" });
    const l2 = await service.createFromReview({ projectId, severity: "major", title: "L2", description: "D2" });
    await service.approve(l1.id);
    await service.approve(l2.id);

    // l1 triggered, l2 not
    await service.onChapterCompleted(projectId, [l1.id]);

    const l1After = await service.getById(l1.id);
    const l2After = await service.getById(l2.id);
    expect(l1After?.inactiveChapters).toBe(0);
    expect(l2After?.inactiveChapters).toBe(1);
  });

  it("过期淘汰: 连续N章未触发 → archived", async () => {
    const lesson = await service.createFromReview({
      projectId, severity: "major", title: "T", description: "D",
    });
    await service.approve(lesson.id);

    // Simulate 20 chapters without triggering
    for (let i = 0; i < DEFAULT_LESSON_EXPIRY_THRESHOLD; i++) {
      await service.onChapterCompleted(projectId, []);
    }

    const expired = await service.getById(lesson.id);
    expect(expired?.status).toBe("archived");
  });

  it("手动归档lesson", async () => {
    const lesson = await service.createFromReview({
      projectId, severity: "major", title: "T", description: "D",
    });
    await service.approve(lesson.id);

    const archived = await service.archive(lesson.id);
    expect(archived.status).toBe("archived");
  });

  it("删除lesson", async () => {
    const lesson = await service.createFromReview({
      projectId, severity: "major", title: "T", description: "D",
    });
    await service.delete(lesson.id);
    const found = await service.getById(lesson.id);
    expect(found).toBeNull();
  });
});

// ── KnowledgeLoader Tests ───────────────────────────────

describe("KnowledgeLoader", () => {
  let knowledgeStore: InMemoryKnowledgeStore;
  let lessonStore: InMemoryLessonStore;
  let loader: KnowledgeLoader;
  const projectId = "test-project";

  beforeEach(async () => {
    knowledgeStore = new InMemoryKnowledgeStore();
    lessonStore = new InMemoryLessonStore();
    loader = new KnowledgeLoader(knowledgeStore, lessonStore);

    // Seed some knowledge entries
    await knowledgeStore.create({
      scope: "global",
      category: "writing_craft",
      title: "去AI味",
      content: "去AI味指南内容...",
      tags: ["anti-ai"],
      consumers: ["执笔", "明镜"],
    });
    await knowledgeStore.create({
      scope: "global",
      category: "genre",
      title: "仙侠",
      content: "仙侠写作技法...",
      tags: ["xianxia"],
      consumers: ["执笔", "匠心"],
    });
    await knowledgeStore.create({
      scope: "global",
      category: "style",
      title: "战斗编排",
      content: "战斗场景写法...",
      tags: ["action"],
      consumers: ["执笔"],
    });
    await knowledgeStore.create({
      scope: "global",
      category: "reference",
      title: "大奉打更人节奏分析",
      content: "参考作品沉淀...",
      consumers: ["执笔", "匠心", "明镜"],
    });
  });

  it("执笔: eager加载写作技巧", async () => {
    const result = await loader.load({
      consumer: "执笔",
      projectId,
    });
    // Should load writing_craft (eager) + reference (tagged)
    expect(result.entries.length).toBeGreaterThanOrEqual(2);
    expect(result.loadStrategy.writing_craft).toBe("eager");
    expect(result.loadStrategy.reference).toBe("tagged");
  });

  it("执笔: selective加载题材知识", async () => {
    const result = await loader.load({
      consumer: "执笔",
      projectId,
      genreTags: ["xianxia"],
    });
    const genreEntry = result.entries.find((e) => e.title === "仙侠");
    expect(genreEntry).toBeDefined();
    expect(result.loadStrategy.genre).toBe("selective");
  });

  it("执笔: on-demand加载风格专项", async () => {
    const result = await loader.load({
      consumer: "执笔",
      projectId,
      chapterType: "action",
    });
    const styleEntry = result.entries.find((e) => e.title === "战斗编排");
    expect(styleEntry).toBeDefined();
    expect(result.loadStrategy.style).toBe("on_demand");
  });

  it("执笔: filtered加载lessons", async () => {
    const lesson = await lessonStore.create({
      projectId,
      severity: "major",
      title: "测试lesson",
      description: "这是一条测试教训",
      tags: ["anti-ai"],
    });
    await lessonStore.updateStatus(lesson.id, "active");

    const result = await loader.load({
      consumer: "执笔",
      projectId,
    });
    expect(result.lessons).toHaveLength(1);
    expect(result.loadStrategy.lessons).toBe("filtered");
  });

  it("明镜: 加载lessons和reference", async () => {
    const lesson = await lessonStore.create({
      projectId,
      severity: "major",
      title: "测试",
      description: "测试",
    });
    await lessonStore.updateStatus(lesson.id, "active");

    const result = await loader.load({
      consumer: "明镜",
      projectId,
    });
    expect(result.lessons).toHaveLength(1);
    expect(result.entries.some((e) => e.category === "reference")).toBe(true);
  });

  it("灵犀: 只加载reference", async () => {
    const result = await loader.load({
      consumer: "灵犀",
      projectId,
    });
    expect(result.lessons).toHaveLength(0);
    expect(result.loadStrategy.reference).toBe("tagged");
  });

  it("匠心: selective题材 + reference", async () => {
    const result = await loader.load({
      consumer: "匠心",
      projectId,
      genreTags: ["xianxia"],
    });
    expect(result.entries.some((e) => e.category === "genre")).toBe(true);
    expect(result.entries.some((e) => e.category === "reference")).toBe(true);
  });

  it("未知agent: 只加载tagged条目", async () => {
    await knowledgeStore.create({
      scope: "global",
      category: "reference",
      content: "测试",
      consumers: ["博闻"],
    });

    const result = await loader.load({
      consumer: "博闻",
      projectId,
    });
    expect(result.entries.length).toBeGreaterThanOrEqual(1);
  });

  it("token预算限制截断", async () => {
    // Create a very large entry
    const longContent = "这".repeat(10000);
    await knowledgeStore.create({
      scope: "global",
      category: "writing_craft",
      content: longContent,
      consumers: ["执笔"],
    });

    const result = await loader.load({
      consumer: "执笔",
      projectId,
      maxTokens: 100, // very small budget
    });
    // Should be truncated
    expect(result.totalTokens).toBeLessThanOrEqual(100);
  });

  it("de-duplicate across strategies", async () => {
    // The reference entry has consumers: ["执笔", "匠心", "明镜"]
    // It matches both eager (writing_craft) and tagged (reference) for 执笔
    // But the actual "reference" entry is category=reference, not writing_craft
    // So no real duplicate. Let's create one that genuinely appears in two strategies.
    await knowledgeStore.create({
      scope: "global",
      category: "writing_craft",
      content: "双重匹配",
      tags: ["xianxia"],
      consumers: ["执笔"],
    });

    const result = await loader.load({
      consumer: "执笔",
      projectId,
      genreTags: ["xianxia"],
    });

    // Count entries with "双重匹配"
    const dupes = result.entries.filter((e) => e.content === "双重匹配");
    expect(dupes).toHaveLength(1); // should be de-duplicated
  });
});

// ── Seed Data Tests ─────────────────────────────────────

describe("默认知识库种子数据", () => {
  it("getDefaultKnowledgeEntries 返回非空数组", () => {
    const entries = getDefaultKnowledgeEntries();
    expect(entries.length).toBeGreaterThanOrEqual(5);
  });

  it("每条种子都有 scope=global", () => {
    for (const entry of DEFAULT_KNOWLEDGE_ENTRIES) {
      expect(entry.scope).toBe("global");
    }
  });

  it("每条种子都有 content", () => {
    for (const entry of DEFAULT_KNOWLEDGE_ENTRIES) {
      expect(entry.content.length).toBeGreaterThan(0);
    }
  });

  it("覆盖所有知识库类别", () => {
    const categories = new Set(DEFAULT_KNOWLEDGE_ENTRIES.map((e) => e.category));
    expect(categories.has("writing_craft")).toBe(true);
    expect(categories.has("genre")).toBe(true);
    expect(categories.has("style")).toBe(true);
  });

  it("种子数据可成功写入 InMemoryStore", async () => {
    const store = new InMemoryKnowledgeStore();
    const service = new KnowledgeService(store);

    for (const entry of DEFAULT_KNOWLEDGE_ENTRIES) {
      await service.create(entry);
    }

    const all = await service.listByScope("global");
    expect(all).toHaveLength(DEFAULT_KNOWLEDGE_ENTRIES.length);
  });
});

// ── Constants Tests ─────────────────────────────────────

describe("常量和配置", () => {
  it("AGENT_KNOWLEDGE_BUDGETS 包含四大 Agent", () => {
    expect(AGENT_KNOWLEDGE_BUDGETS["灵犀"]).toBeDefined();
    expect(AGENT_KNOWLEDGE_BUDGETS["匠心"]).toBeDefined();
    expect(AGENT_KNOWLEDGE_BUDGETS["执笔"]).toBeDefined();
    expect(AGENT_KNOWLEDGE_BUDGETS["明镜"]).toBeDefined();
  });

  it("执笔有最大的总预算", () => {
    const writerBudget = AGENT_KNOWLEDGE_BUDGETS["执笔"];
    expect(writerBudget).toBeDefined();
    if (writerBudget) {
      expect(writerBudget.totalBudget).toBe(64000);
    }
  });

  it("DEFAULT_LESSON_EXPIRY_THRESHOLD 是 20", () => {
    expect(DEFAULT_LESSON_EXPIRY_THRESHOLD).toBe(20);
  });

  it("MAX_ENTRY_TOKENS 是 800", () => {
    expect(MAX_ENTRY_TOKENS).toBe(800);
  });
});
