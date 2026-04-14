/**
 * DrizzleSliceStore — Drizzle ORM 实现的 SliceStore
 *
 * 实现 UNM 定义的 SliceStore 接口，连接 memory_slices 表。
 * 支持按 category/tier/stability/scope/freshness/tags 过滤查询。
 */

import { and, eq, gte, sql } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { memorySlices } from "../db/schema/memory.js";
import type { MemoryCategory, MemoryTier } from "../types/index.js";
import type { MemorySlice, SliceFilter, SliceStore } from "../unm/types.js";

/** 将 Drizzle 行映射为 MemorySlice */
function toMemorySlice(row: typeof memorySlices.$inferSelect): MemorySlice {
  return {
    id: row.id,
    projectId: row.projectId,
    category: row.category as MemorySlice["category"],
    scope: (row.scope ?? "global") as MemorySlice["scope"],
    stability: (row.stability ?? "evolving") as MemorySlice["stability"],
    tier: (row.tier ?? "warm") as MemorySlice["tier"],
    priorityFloor: row.priorityFloor ?? 0,
    content: row.content ?? "",
    charCount: row.charCount ?? 0,
    tokenCount: row.tokenCount ?? 0,
    freshness: row.freshness ?? 1,
    relevanceTags: row.relevanceTags ?? [],
    sourceChapter: row.sourceChapter ?? undefined,
    sourceAgent: row.sourceAgent ?? undefined,
    chapterNumber: row.chapterNumber ?? undefined,
    importance: row.importance ?? undefined,
    createdAt: row.createdAt ?? new Date(),
    updatedAt: row.updatedAt ?? new Date(),
  };
}

export class DrizzleSliceStore implements SliceStore {
  constructor(private db: Database) {}

  async query(projectId: string, filters?: SliceFilter): Promise<MemorySlice[]> {
    const conditions = [eq(memorySlices.projectId, projectId)];

    if (filters?.category) {
      conditions.push(eq(memorySlices.category, filters.category));
    }
    if (filters?.tier) {
      conditions.push(eq(memorySlices.tier, filters.tier));
    }
    if (filters?.stability) {
      conditions.push(eq(memorySlices.stability, filters.stability));
    }
    if (filters?.scope) {
      conditions.push(eq(memorySlices.scope, filters.scope));
    }
    if (filters?.minFreshness !== undefined) {
      conditions.push(gte(memorySlices.freshness, filters.minFreshness));
    }
    if (filters?.sourceChapter !== undefined) {
      conditions.push(eq(memorySlices.sourceChapter, filters.sourceChapter));
    }
    // relevanceTags filter uses array overlap operator
    if (filters?.relevanceTags && filters.relevanceTags.length > 0) {
      conditions.push(
        sql`${memorySlices.relevanceTags} && ${sql.raw(`ARRAY[${filters.relevanceTags.map((t) => `'${t}'`).join(",")}]::text[]`)}`,
      );
    }

    const rows = await this.db.select().from(memorySlices).where(and(...conditions));
    return rows.map(toMemorySlice);
  }

  async insert(slice: Omit<MemorySlice, "id" | "createdAt" | "updatedAt">): Promise<MemorySlice> {
    const rows = await this.db
      .insert(memorySlices)
      .values({
        projectId: slice.projectId,
        category: slice.category,
        scope: slice.scope,
        stability: slice.stability,
        tier: slice.tier,
        priorityFloor: slice.priorityFloor,
        content: slice.content,
        charCount: slice.charCount,
        tokenCount: slice.tokenCount,
        freshness: slice.freshness,
        relevanceTags: slice.relevanceTags,
        sourceChapter: slice.sourceChapter,
        sourceAgent: slice.sourceAgent,
        chapterNumber: slice.chapterNumber,
        importance: slice.importance,
      })
      .returning();

    const inserted = rows[0];
    if (!inserted) {
      throw new Error("Failed to insert MemorySlice — no row returned");
    }
    return toMemorySlice(inserted);
  }

  async update(id: string, patch: Partial<MemorySlice>): Promise<MemorySlice> {
    // Build explicit update object from patch, excluding read-only fields
    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.category !== undefined) updateValues.category = patch.category;
    if (patch.scope !== undefined) updateValues.scope = patch.scope;
    if (patch.stability !== undefined) updateValues.stability = patch.stability;
    if (patch.tier !== undefined) updateValues.tier = patch.tier;
    if (patch.priorityFloor !== undefined) updateValues.priorityFloor = patch.priorityFloor;
    if (patch.content !== undefined) updateValues.content = patch.content;
    if (patch.charCount !== undefined) updateValues.charCount = patch.charCount;
    if (patch.tokenCount !== undefined) updateValues.tokenCount = patch.tokenCount;
    if (patch.freshness !== undefined) updateValues.freshness = patch.freshness;
    if (patch.relevanceTags !== undefined) updateValues.relevanceTags = patch.relevanceTags;
    if (patch.sourceChapter !== undefined) updateValues.sourceChapter = patch.sourceChapter;
    if (patch.sourceAgent !== undefined) updateValues.sourceAgent = patch.sourceAgent;
    if (patch.chapterNumber !== undefined) updateValues.chapterNumber = patch.chapterNumber;
    if (patch.importance !== undefined) updateValues.importance = patch.importance;

    const rows = await this.db
      .update(memorySlices)
      .set(updateValues)
      .where(eq(memorySlices.id, id))
      .returning();

    const updated = rows[0];
    if (!updated) {
      throw new Error(`MemorySlice "${id}" not found`);
    }
    return toMemorySlice(updated);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(memorySlices).where(eq(memorySlices.id, id));
  }

  async countTokens(projectId: string, category: MemoryCategory, tier: MemoryTier): Promise<number> {
    const result = await this.db
      .select({ total: sql<number>`COALESCE(SUM(${memorySlices.tokenCount}), 0)` })
      .from(memorySlices)
      .where(
        and(
          eq(memorySlices.projectId, projectId),
          eq(memorySlices.category, category),
          eq(memorySlices.tier, tier),
        ),
      );

    return Number(result[0]?.total ?? 0);
  }
}
