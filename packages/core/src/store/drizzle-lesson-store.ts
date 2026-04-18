/**
 * DrizzleLessonStore — Drizzle ORM 实现的 LessonStore
 *
 * 实现 lessons-service.ts 定义的 LessonStore 接口，
 * 连接 lessons 表。
 */

import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { lessons } from "../db/schema/lessons.js";
import type { LessonStore } from "../knowledge/lessons-service.js";
import type {
  Lesson,
  LessonFilter,
  LessonStatus,
  CreateLessonInput,
} from "../knowledge/types.js";
import { DEFAULT_LESSON_EXPIRY_THRESHOLD } from "../knowledge/types.js";

/** 将 Drizzle 行映射为 Lesson */
function toLesson(row: typeof lessons.$inferSelect): Lesson {
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status as LessonStatus,
    severity: row.severity as Lesson["severity"],
    title: row.title,
    description: row.description,
    sourceChapter: row.sourceChapter ?? null,
    sourceAgent: row.sourceAgent ?? null,
    issueType: row.issueType ?? null,
    tags: row.tags ?? [],
    lastTriggeredChapter: row.lastTriggeredChapter ?? null,
    triggerCount: row.triggerCount ?? 0,
    inactiveChapters: row.inactiveChapters ?? 0,
    expiryThreshold: row.expiryThreshold ?? DEFAULT_LESSON_EXPIRY_THRESHOLD,
    createdAt: row.createdAt ?? new Date(),
    updatedAt: row.updatedAt ?? new Date(),
  };
}

export class DrizzleLessonStore implements LessonStore {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Lesson | null> {
    const rows = await this.db
      .select()
      .from(lessons)
      .where(eq(lessons.id, id))
      .limit(1);
    return rows[0] ? toLesson(rows[0]) : null;
  }

  async findMany(filter: LessonFilter): Promise<Lesson[]> {
    const conditions = [eq(lessons.projectId, filter.projectId)];

    if (filter.status) {
      conditions.push(eq(lessons.status, filter.status));
    }
    if (filter.severity) {
      conditions.push(eq(lessons.severity, filter.severity));
    }
    if (filter.issueType) {
      conditions.push(eq(lessons.issueType, filter.issueType));
    }
    if (filter.tags && filter.tags.length > 0) {
      const lowered = filter.tags.map((t) => t.toLowerCase());
      conditions.push(
        sql`EXISTS (SELECT 1 FROM unnest(${lessons.tags}) AS t WHERE LOWER(t) = ANY(${lowered}))`,
      );
    }

    const rows = await this.db.select().from(lessons).where(and(...conditions));
    return rows.map(toLesson);
  }

  async findActive(projectId: string): Promise<Lesson[]> {
    const rows = await this.db
      .select()
      .from(lessons)
      .where(
        and(
          eq(lessons.projectId, projectId),
          eq(lessons.status, "active"),
        ),
      );
    return rows.map(toLesson);
  }

  async findPending(projectId: string): Promise<Lesson[]> {
    const rows = await this.db
      .select()
      .from(lessons)
      .where(
        and(
          eq(lessons.projectId, projectId),
          eq(lessons.status, "pending"),
        ),
      );
    return rows.map(toLesson);
  }

  async create(input: CreateLessonInput): Promise<Lesson> {
    const rows = await this.db
      .insert(lessons)
      .values({
        projectId: input.projectId,
        status: "pending",
        severity: input.severity,
        title: input.title,
        description: input.description,
        sourceChapter: input.sourceChapter ?? null,
        sourceAgent: input.sourceAgent ?? null,
        issueType: input.issueType ?? null,
        tags: input.tags ?? [],
        triggerCount: 0,
        inactiveChapters: 0,
        expiryThreshold: DEFAULT_LESSON_EXPIRY_THRESHOLD,
      })
      .returning();

    const inserted = rows[0];
    if (!inserted) {
      throw new Error("Failed to insert Lesson — no row returned");
    }
    return toLesson(inserted);
  }

  async updateStatus(id: string, status: LessonStatus): Promise<Lesson> {
    const rows = await this.db
      .update(lessons)
      .set({ status, updatedAt: new Date() })
      .where(eq(lessons.id, id))
      .returning();

    const updated = rows[0];
    if (!updated) {
      throw new Error(`Lesson "${id}" not found`);
    }
    return toLesson(updated);
  }

  async updateTrigger(id: string, chapterNumber: number, triggerCount: number): Promise<Lesson> {
    const rows = await this.db
      .update(lessons)
      .set({
        lastTriggeredChapter: chapterNumber,
        triggerCount,
        inactiveChapters: 0,
        updatedAt: new Date(),
      })
      .where(eq(lessons.id, id))
      .returning();

    const updated = rows[0];
    if (!updated) {
      throw new Error(`Lesson "${id}" not found`);
    }
    return toLesson(updated);
  }

  async incrementInactive(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(lessons)
      .set({
        inactiveChapters: sql`${lessons.inactiveChapters} + 1`,
        updatedAt: new Date(),
      })
      .where(inArray(lessons.id, ids));
  }

  async resetInactive(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(lessons)
      .set({
        inactiveChapters: 0,
        updatedAt: new Date(),
      })
      .where(inArray(lessons.id, ids));
  }

  async archiveExpired(projectId: string, threshold: number): Promise<number> {
    const rows = await this.db
      .update(lessons)
      .set({ status: "archived", updatedAt: new Date() })
      .where(
        and(
          eq(lessons.projectId, projectId),
          eq(lessons.status, "active"),
          gte(lessons.inactiveChapters, threshold),
        ),
      )
      .returning({ id: lessons.id });

    return rows.length;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(lessons).where(eq(lessons.id, id));
  }
}
