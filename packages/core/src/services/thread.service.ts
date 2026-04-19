import { eq, and } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { plotThreads } from "../db/schema/outline.js";
import type { ServiceResult } from "./types.js";

type Thread = typeof plotThreads.$inferSelect;
type NewThread = typeof plotThreads.$inferInsert;

export async function create(
  projectId: string,
  data: Omit<NewThread, "id" | "projectId" | "createdAt">,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db
    .insert(plotThreads)
    .values({ projectId, ...data })
    .returning({ id: plotThreads.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "伏笔创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function read(
  projectId: string,
  id: string,
): Promise<ServiceResult<Thread>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(plotThreads)
    .where(and(eq(plotThreads.id, id), eq(plotThreads.projectId, projectId)))
    .limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "伏笔不存在" } };
  return { ok: true, data: row };
}

export async function list(
  projectId: string,
  status?: NewThread["status"],
): Promise<ServiceResult<Thread[]>> {
  const db = getDb();
  const conditions = [eq(plotThreads.projectId, projectId)];
  if (status) conditions.push(eq(plotThreads.status, status));
  const rows = await db
    .select()
    .from(plotThreads)
    .where(and(...conditions))
    .orderBy(plotThreads.createdAt);
  return { ok: true, data: rows };
}

export async function update(
  id: string,
  data: Partial<Omit<NewThread, "id" | "projectId" | "createdAt">>,
): Promise<ServiceResult<Thread>> {
  const db = getDb();
  const rows = await db
    .update(plotThreads)
    .set(data)
    .where(eq(plotThreads.id, id))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "伏笔不存在" } };
  return { ok: true, data: row };
}
