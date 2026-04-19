import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { lessons } from "../db/schema/lessons.js";
import type { ServiceResult } from "./types.js";

type Lesson = typeof lessons.$inferSelect;
type NewLesson = typeof lessons.$inferInsert;

export async function create(
  projectId: string,
  data: Omit<NewLesson, "id" | "projectId" | "createdAt" | "updatedAt">,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db
    .insert(lessons)
    .values({ projectId, ...data })
    .returning({ id: lessons.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "教训创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function read(
  projectId: string,
  id: string,
): Promise<ServiceResult<Lesson>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.id, id), eq(lessons.projectId, projectId)))
    .limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "教训不存在" } };
  return { ok: true, data: row };
}

export async function list(
  projectId: string,
  status?: NewLesson["status"],
): Promise<ServiceResult<Lesson[]>> {
  const db = getDb();
  const conditions = [eq(lessons.projectId, projectId)];
  if (status) conditions.push(eq(lessons.status, status));
  const rows = await db
    .select()
    .from(lessons)
    .where(and(...conditions))
    .orderBy(desc(lessons.updatedAt));
  return { ok: true, data: rows };
}

export async function update(
  id: string,
  data: Partial<Omit<NewLesson, "id" | "projectId" | "createdAt" | "updatedAt">>,
): Promise<ServiceResult<Lesson>> {
  const db = getDb();
  const rows = await db
    .update(lessons)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(lessons.id, id))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "教训不存在" } };
  return { ok: true, data: row };
}
