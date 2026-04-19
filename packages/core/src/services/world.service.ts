import { eq, and } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { worldSettings } from "../db/schema/world.js";
import { worldStates } from "../db/schema/world.js";
import type { ServiceResult } from "./types.js";

type Setting = typeof worldSettings.$inferSelect;
type WorldState = typeof worldStates.$inferSelect;
type NewWorldState = typeof worldStates.$inferInsert;

// ── World Settings ──

export async function createSetting(
  projectId: string,
  data: { section: string; name?: string; content: string; sortOrder?: number },
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db
    .insert(worldSettings)
    .values({ projectId, ...data })
    .returning({ id: worldSettings.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "世界设定创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function readSetting(
  projectId: string,
  id: string,
): Promise<ServiceResult<Setting>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(worldSettings)
    .where(and(eq(worldSettings.id, id), eq(worldSettings.projectId, projectId)))
    .limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "世界设定不存在" } };
  return { ok: true, data: row };
}

export async function listSettings(
  projectId: string,
  section?: string,
): Promise<ServiceResult<Setting[]>> {
  const db = getDb();
  const conditions = [eq(worldSettings.projectId, projectId)];
  if (section) conditions.push(eq(worldSettings.section, section));
  const rows = await db
    .select()
    .from(worldSettings)
    .where(and(...conditions))
    .orderBy(worldSettings.sortOrder, worldSettings.createdAt);
  return { ok: true, data: rows };
}

export async function updateSetting(
  id: string,
  data: { section?: string; name?: string; content: string; sortOrder?: number },
): Promise<ServiceResult<Setting>> {
  const db = getDb();
  const rows = await db
    .update(worldSettings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(worldSettings.id, id))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "世界设定不存在" } };
  return { ok: true, data: row };
}

export async function patchSetting(
  id: string,
  data: { section?: string; name?: string; content?: string; sortOrder?: number },
): Promise<ServiceResult<Setting>> {
  const db = getDb();
  const updates: Record<string, unknown> = {};
  if (data.section !== undefined) updates.section = data.section;
  if (data.name !== undefined) updates.name = data.name;
  if (data.content !== undefined) updates.content = data.content;
  if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: { code: "NO_FIELDS", message: "没有需要更新的字段" } };
  }
  updates.updatedAt = new Date();

  const rows = await db
    .update(worldSettings)
    .set(updates)
    .where(eq(worldSettings.id, id))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "世界设定不存在" } };
  return { ok: true, data: row };
}

export async function removeSetting(id: string): Promise<ServiceResult<void>> {
  const db = getDb();
  const rows = await db
    .delete(worldSettings)
    .where(eq(worldSettings.id, id))
    .returning({ id: worldSettings.id });
  if (rows.length === 0) return { ok: false, error: { code: "NOT_FOUND", message: "世界设定不存在" } };
  return { ok: true, data: undefined };
}

// ── World States (per-chapter snapshots) ──

export async function createState(
  projectId: string,
  data: Omit<NewWorldState, "id" | "projectId" | "createdAt">,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db
    .insert(worldStates)
    .values({ projectId, ...data })
    .returning({ id: worldStates.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "世界状态创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function readState(
  projectId: string,
  chapterNumber: number,
): Promise<ServiceResult<WorldState>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(worldStates)
    .where(and(eq(worldStates.projectId, projectId), eq(worldStates.chapterNumber, chapterNumber)))
    .limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "该章节世界状态不存在" } };
  return { ok: true, data: row };
}

export async function listStates(projectId: string): Promise<ServiceResult<WorldState[]>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(worldStates)
    .where(eq(worldStates.projectId, projectId))
    .orderBy(worldStates.chapterNumber);
  return { ok: true, data: rows };
}
