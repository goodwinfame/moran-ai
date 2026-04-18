/**
 * DrizzleKnowledgeStore — Drizzle ORM 实现的 KnowledgeStore
 *
 * 实现 knowledge-service.ts 定义的 KnowledgeStore 接口，
 * 连接 knowledge_entries + knowledge_versions 表。
 */

import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { knowledgeEntries, knowledgeVersions } from "../db/schema/knowledge.js";
import type { KnowledgeStore } from "../knowledge/knowledge-service.js";
import type {
  KnowledgeEntry,
  KnowledgeFilter,
  KnowledgeVersion,
  KnowledgeScope,
  KnowledgeCategory,
  CreateKnowledgeInput,
  UpdateKnowledgeInput,
} from "../knowledge/types.js";

/** 将 Drizzle 行映射为 KnowledgeEntry */
function toKnowledgeEntry(row: typeof knowledgeEntries.$inferSelect): KnowledgeEntry {
  return {
    id: row.id,
    scope: row.scope as KnowledgeScope,
    category: (row.category ?? "reference") as KnowledgeCategory,
    title: row.title ?? null,
    content: row.content,
    tags: row.tags ?? [],
    consumers: row.consumers ?? [],
    version: row.version ?? 1,
    createdAt: row.createdAt ?? new Date(),
    updatedAt: row.updatedAt ?? new Date(),
  };
}

/** 将 Drizzle 行映射为 KnowledgeVersion */
function toKnowledgeVersion(row: typeof knowledgeVersions.$inferSelect): KnowledgeVersion {
  return {
    id: row.id,
    knowledgeEntryId: row.knowledgeEntryId,
    version: row.version,
    content: row.content,
    updatedBy: row.updatedBy ?? null,
    createdAt: row.createdAt ?? new Date(),
  };
}

export class DrizzleKnowledgeStore implements KnowledgeStore {
  constructor(private db: Database) {}

  async findById(id: string): Promise<KnowledgeEntry | null> {
    const rows = await this.db
      .select()
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.id, id))
      .limit(1);
    return rows[0] ? toKnowledgeEntry(rows[0]) : null;
  }

  async findMany(filter: KnowledgeFilter): Promise<KnowledgeEntry[]> {
    const conditions = [];

    if (filter.scope) {
      conditions.push(eq(knowledgeEntries.scope, filter.scope));
    }
    if (filter.category) {
      conditions.push(eq(knowledgeEntries.category, filter.category));
    }
    if (filter.tags && filter.tags.length > 0) {
      // Case-insensitive array overlap via unnest + LOWER
      const lowered = filter.tags.map((t) => t.toLowerCase());
      conditions.push(
        sql`EXISTS (SELECT 1 FROM unnest(${knowledgeEntries.tags}) AS t WHERE LOWER(t) = ANY(${lowered}))`,
      );
    }
    if (filter.consumers && filter.consumers.length > 0) {
      const lowered = filter.consumers.map((c) => c.toLowerCase());
      conditions.push(
        sql`EXISTS (SELECT 1 FROM unnest(${knowledgeEntries.consumers}) AS c WHERE LOWER(c) = ANY(${lowered}))`,
      );
    }

    const query = conditions.length > 0
      ? this.db.select().from(knowledgeEntries).where(and(...conditions))
      : this.db.select().from(knowledgeEntries);

    const rows = await query;
    return rows.map(toKnowledgeEntry);
  }

  async findByScope(scope: KnowledgeScope): Promise<KnowledgeEntry[]> {
    const rows = await this.db
      .select()
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.scope, scope));
    return rows.map(toKnowledgeEntry);
  }

  async findByScopeAndCategory(scope: KnowledgeScope, category: KnowledgeCategory): Promise<KnowledgeEntry[]> {
    const rows = await this.db
      .select()
      .from(knowledgeEntries)
      .where(
        and(
          eq(knowledgeEntries.scope, scope),
          eq(knowledgeEntries.category, category),
        ),
      );
    return rows.map(toKnowledgeEntry);
  }

  async findByConsumer(consumer: string, scopes: KnowledgeScope[]): Promise<KnowledgeEntry[]> {
    if (scopes.length === 0) return [];

    const consumerLower = consumer.toLowerCase();
    const rows = await this.db
      .select()
      .from(knowledgeEntries)
      .where(
        and(
          sql`${knowledgeEntries.scope} = ANY(${scopes})`,
          sql`EXISTS (SELECT 1 FROM unnest(${knowledgeEntries.consumers}) AS c WHERE LOWER(c) = ${consumerLower})`,
        ),
      );
    return rows.map(toKnowledgeEntry);
  }

  async create(input: CreateKnowledgeInput): Promise<KnowledgeEntry> {
    const rows = await this.db
      .insert(knowledgeEntries)
      .values({
        scope: input.scope,
        category: input.category,
        title: input.title ?? null,
        content: input.content,
        tags: input.tags ?? [],
        consumers: input.consumers ?? [],
        version: 1,
      })
      .returning();

    const inserted = rows[0];
    if (!inserted) {
      throw new Error("Failed to insert KnowledgeEntry — no row returned");
    }
    return toKnowledgeEntry(inserted);
  }

  async update(id: string, input: UpdateKnowledgeInput, newVersion: number): Promise<KnowledgeEntry> {
    const updateValues: Record<string, unknown> = {
      version: newVersion,
      updatedAt: new Date(),
    };
    if (input.title !== undefined) updateValues.title = input.title ?? null;
    if (input.content !== undefined) updateValues.content = input.content;
    if (input.tags !== undefined) updateValues.tags = input.tags;
    if (input.consumers !== undefined) updateValues.consumers = input.consumers;

    const rows = await this.db
      .update(knowledgeEntries)
      .set(updateValues)
      .where(eq(knowledgeEntries.id, id))
      .returning();

    const updated = rows[0];
    if (!updated) {
      throw new Error(`KnowledgeEntry "${id}" not found`);
    }
    return toKnowledgeEntry(updated);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(knowledgeEntries).where(eq(knowledgeEntries.id, id));
  }

  async createVersion(entryId: string, version: number, content: string, updatedBy?: string): Promise<KnowledgeVersion> {
    const rows = await this.db
      .insert(knowledgeVersions)
      .values({
        knowledgeEntryId: entryId,
        version,
        content,
        updatedBy: updatedBy ?? null,
      })
      .returning();

    const inserted = rows[0];
    if (!inserted) {
      throw new Error("Failed to insert KnowledgeVersion — no row returned");
    }
    return toKnowledgeVersion(inserted);
  }

  async getVersions(entryId: string): Promise<KnowledgeVersion[]> {
    const rows = await this.db
      .select()
      .from(knowledgeVersions)
      .where(eq(knowledgeVersions.knowledgeEntryId, entryId))
      .orderBy(sql`${knowledgeVersions.version} DESC`);
    return rows.map(toKnowledgeVersion);
  }

  async getVersion(entryId: string, version: number): Promise<KnowledgeVersion | null> {
    const rows = await this.db
      .select()
      .from(knowledgeVersions)
      .where(
        and(
          eq(knowledgeVersions.knowledgeEntryId, entryId),
          eq(knowledgeVersions.version, version),
        ),
      )
      .limit(1);
    return rows[0] ? toKnowledgeVersion(rows[0]) : null;
  }
}
