import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { styleConfigs } from "../db/schema/styles.js";
import type { ServiceResult } from "./types.js";

type Style = typeof styleConfigs.$inferSelect;
type NewStyle = typeof styleConfigs.$inferInsert;

export async function create(
  data: Omit<NewStyle, "id" | "createdAt" | "updatedAt">,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db.insert(styleConfigs).values(data).returning({ id: styleConfigs.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "风格配置创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function read(id: string): Promise<ServiceResult<Style>> {
  const db = getDb();
  const [row] = await db.select().from(styleConfigs).where(eq(styleConfigs.id, id)).limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "风格配置不存在" } };
  return { ok: true, data: row };
}

export async function readByStyleId(
  styleId: string,
  projectId?: string,
): Promise<ServiceResult<Style>> {
  const db = getDb();
  const conditions = [eq(styleConfigs.styleId, styleId)];
  if (projectId) {
    conditions.push(eq(styleConfigs.projectId, projectId));
  }
  const [row] = await db
    .select()
    .from(styleConfigs)
    .where(and(...conditions))
    .limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "风格配置不存在" } };
  return { ok: true, data: row };
}

export async function list(projectId?: string): Promise<ServiceResult<Style[]>> {
  const db = getDb();
  const conditions = [eq(styleConfigs.isActive, true)];
  if (projectId) {
    conditions.push(eq(styleConfigs.projectId, projectId));
  }
  const rows = await db
    .select()
    .from(styleConfigs)
    .where(and(...conditions))
    .orderBy(desc(styleConfigs.updatedAt));
  return { ok: true, data: rows };
}

export async function update(
  id: string,
  data: Partial<Omit<NewStyle, "id" | "createdAt" | "updatedAt">>,
): Promise<ServiceResult<Style>> {
  const db = getDb();
  const rows = await db
    .update(styleConfigs)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(styleConfigs.id, id))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "风格配置不存在" } };
  return { ok: true, data: row };
}
