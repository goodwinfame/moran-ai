import { eq, and } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { characterRelationships } from "../db/schema/relationships.js";
import { relationshipStates } from "../db/schema/relationships.js";
import type { ServiceResult } from "./types.js";

type Relationship = typeof characterRelationships.$inferSelect;
type NewRelationship = typeof characterRelationships.$inferInsert;
type RelState = typeof relationshipStates.$inferSelect;
type NewRelState = typeof relationshipStates.$inferInsert;

// ── Relationships ──

export async function create(
  projectId: string,
  data: Omit<NewRelationship, "id" | "projectId">,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db
    .insert(characterRelationships)
    .values({ projectId, ...data })
    .returning({ id: characterRelationships.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "关系创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function read(
  projectId: string,
  id: string,
): Promise<ServiceResult<Relationship>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(characterRelationships)
    .where(and(eq(characterRelationships.id, id), eq(characterRelationships.projectId, projectId)))
    .limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "关系不存在" } };
  return { ok: true, data: row };
}

export async function list(
  projectId: string,
  characterId?: string,
): Promise<ServiceResult<Relationship[]>> {
  const db = getDb();
  const conditions = [eq(characterRelationships.projectId, projectId)];
  if (characterId) {
    conditions.push(eq(characterRelationships.sourceId, characterId));
  }
  const rows = await db
    .select()
    .from(characterRelationships)
    .where(and(...conditions));
  return { ok: true, data: rows };
}

export async function update(
  id: string,
  data: Partial<Omit<NewRelationship, "id" | "projectId">>,
): Promise<ServiceResult<Relationship>> {
  const db = getDb();
  const rows = await db
    .update(characterRelationships)
    .set(data)
    .where(eq(characterRelationships.id, id))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "关系不存在" } };
  return { ok: true, data: row };
}

// ── Relationship States (per-chapter snapshots) ──

export async function createState(
  data: Omit<NewRelState, "id" | "createdAt">,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db
    .insert(relationshipStates)
    .values(data)
    .returning({ id: relationshipStates.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "关系状态创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function readStates(
  sourceId: string,
  targetId: string,
  chapterNumber?: number,
): Promise<ServiceResult<RelState[]>> {
  const db = getDb();
  const conditions = [
    eq(relationshipStates.sourceId, sourceId),
    eq(relationshipStates.targetId, targetId),
  ];
  if (chapterNumber !== undefined) {
    conditions.push(eq(relationshipStates.chapterNumber, chapterNumber));
  }
  const rows = await db
    .select()
    .from(relationshipStates)
    .where(and(...conditions))
    .orderBy(relationshipStates.chapterNumber);
  return { ok: true, data: rows };
}
