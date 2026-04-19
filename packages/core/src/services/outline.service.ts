import { eq, and } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { outlines, arcs } from "../db/schema/outline.js";
import type { ServiceResult } from "./types.js";

type Outline = typeof outlines.$inferSelect;
type Arc = typeof arcs.$inferSelect;
type NewArc = typeof arcs.$inferInsert;

// ── Outline (one per project) ──

export async function createOutline(
  projectId: string,
  data: { synopsis?: string; structureType?: string; themes?: string[] },
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db
    .insert(outlines)
    .values({ projectId, ...data })
    .returning({ id: outlines.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "大纲创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function readOutline(projectId: string): Promise<ServiceResult<Outline>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(outlines)
    .where(eq(outlines.projectId, projectId))
    .limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "大纲不存在" } };
  return { ok: true, data: row };
}

export async function updateOutline(
  projectId: string,
  data: { synopsis?: string; structureType?: string; themes?: string[] },
): Promise<ServiceResult<Outline>> {
  const db = getDb();
  const rows = await db
    .update(outlines)
    .set(data)
    .where(eq(outlines.projectId, projectId))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "大纲不存在" } };
  return { ok: true, data: row };
}

export async function patchOutline(
  projectId: string,
  data: { synopsis?: string; structureType?: string; themes?: string[] },
): Promise<ServiceResult<Outline>> {
  const db = getDb();
  const updates: Record<string, unknown> = {};
  if (data.synopsis !== undefined) updates.synopsis = data.synopsis;
  if (data.structureType !== undefined) updates.structureType = data.structureType;
  if (data.themes !== undefined) updates.themes = data.themes;

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: { code: "NO_FIELDS", message: "没有需要更新的字段" } };
  }
  const rows = await db
    .update(outlines)
    .set(updates)
    .where(eq(outlines.projectId, projectId))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "大纲不存在" } };
  return { ok: true, data: row };
}

// ── Arcs ──

export async function createArc(
  projectId: string,
  data: Omit<NewArc, "id" | "projectId" | "createdAt">,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db
    .insert(arcs)
    .values({ projectId, ...data })
    .returning({ id: arcs.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "弧段创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function readArc(
  projectId: string,
  arcIndex: number,
): Promise<ServiceResult<Arc>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(arcs)
    .where(and(eq(arcs.projectId, projectId), eq(arcs.arcIndex, arcIndex)))
    .limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "弧段不存在" } };
  return { ok: true, data: row };
}

export async function listArcs(projectId: string): Promise<ServiceResult<Arc[]>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(arcs)
    .where(eq(arcs.projectId, projectId))
    .orderBy(arcs.arcIndex);
  return { ok: true, data: rows };
}

export async function updateArc(
  id: string,
  data: Partial<Omit<NewArc, "id" | "projectId" | "createdAt">>,
): Promise<ServiceResult<Arc>> {
  const db = getDb();
  const rows = await db
    .update(arcs)
    .set(data)
    .where(eq(arcs.id, id))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "弧段不存在" } };
  return { ok: true, data: row };
}

export async function patchArc(
  id: string,
  data: { title?: string; description?: string; startChapter?: number; endChapter?: number; detailedPlan?: string },
): Promise<ServiceResult<Arc>> {
  const db = getDb();
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) updates[key] = value;
  }
  if (Object.keys(updates).length === 0) {
    return { ok: false, error: { code: "NO_FIELDS", message: "没有需要更新的字段" } };
  }
  const rows = await db.update(arcs).set(updates).where(eq(arcs.id, id)).returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "弧段不存在" } };
  return { ok: true, data: row };
}
