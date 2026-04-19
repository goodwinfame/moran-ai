import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { knowledgeEntries, knowledgeVersions } from "../db/schema/knowledge.js";
import type { ServiceResult } from "./types.js";

type Knowledge = typeof knowledgeEntries.$inferSelect;
type NewKnowledge = typeof knowledgeEntries.$inferInsert;
type KnowledgeVersion = typeof knowledgeVersions.$inferSelect;

// ── Knowledge Entries ──

export async function create(
  data: Omit<NewKnowledge, "id" | "createdAt" | "updatedAt">,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db
    .insert(knowledgeEntries)
    .values(data)
    .returning({ id: knowledgeEntries.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "知识条目创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function read(id: string): Promise<ServiceResult<Knowledge>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(knowledgeEntries)
    .where(eq(knowledgeEntries.id, id))
    .limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "知识条目不存在" } };
  return { ok: true, data: row };
}

export async function list(
  scope: string,
  category?: NewKnowledge["category"],
): Promise<ServiceResult<Knowledge[]>> {
  const db = getDb();
  const conditions = [eq(knowledgeEntries.scope, scope)];
  if (category) conditions.push(eq(knowledgeEntries.category, category));
  const rows = await db
    .select()
    .from(knowledgeEntries)
    .where(and(...conditions))
    .orderBy(desc(knowledgeEntries.updatedAt));
  return { ok: true, data: rows };
}

export async function update(
  id: string,
  data: Partial<Omit<NewKnowledge, "id" | "createdAt" | "updatedAt">>,
): Promise<ServiceResult<Knowledge>> {
  const db = getDb();
  const rows = await db
    .update(knowledgeEntries)
    .set({
      ...data,
      version: sql`coalesce(${knowledgeEntries.version}, 0) + 1`,
      updatedAt: new Date(),
    })
    .where(eq(knowledgeEntries.id, id))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "知识条目不存在" } };
  return { ok: true, data: row };
}

export async function patch(
  id: string,
  data: {
    title?: string;
    content?: string;
    category?: NewKnowledge["category"];
    tags?: string[];
    consumers?: string[];
  },
): Promise<ServiceResult<Knowledge>> {
  const db = getDb();
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) updates[key] = value;
  }
  if (Object.keys(updates).length === 0) {
    return { ok: false, error: { code: "NO_FIELDS", message: "没有需要更新的字段" } };
  }
  if (updates.content !== undefined) {
    updates.version = sql`coalesce(${knowledgeEntries.version}, 0) + 1`;
  }
  updates.updatedAt = new Date();

  const rows = await db
    .update(knowledgeEntries)
    .set(updates)
    .where(eq(knowledgeEntries.id, id))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "知识条目不存在" } };
  return { ok: true, data: row };
}

export async function remove(id: string): Promise<ServiceResult<void>> {
  const db = getDb();
  const rows = await db
    .delete(knowledgeEntries)
    .where(eq(knowledgeEntries.id, id))
    .returning({ id: knowledgeEntries.id });
  if (rows.length === 0) return { ok: false, error: { code: "NOT_FOUND", message: "知识条目不存在" } };
  return { ok: true, data: undefined };
}

// ── Knowledge Versions ──

export async function createVersion(
  knowledgeEntryId: string,
  data: { version: number; content: string; updatedBy?: string },
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db
    .insert(knowledgeVersions)
    .values({ knowledgeEntryId, ...data })
    .returning({ id: knowledgeVersions.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "知识版本创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function listVersions(
  knowledgeEntryId: string,
): Promise<ServiceResult<KnowledgeVersion[]>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(knowledgeVersions)
    .where(eq(knowledgeVersions.knowledgeEntryId, knowledgeEntryId))
    .orderBy(desc(knowledgeVersions.version));
  return { ok: true, data: rows };
}
