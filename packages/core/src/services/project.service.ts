import { eq, desc } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { projects } from "../db/schema/projects.js";
import type { ServiceResult } from "./types.js";

type Project = typeof projects.$inferSelect;
type NewProject = typeof projects.$inferInsert;

export async function create(
  data: Omit<NewProject, "id" | "createdAt" | "updatedAt">,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db.insert(projects).values(data).returning({ id: projects.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "项目创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function read(projectId: string): Promise<ServiceResult<Project>> {
  const db = getDb();
  const [row] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "项目不存在" } };
  return { ok: true, data: row };
}

export async function list(userId: string): Promise<ServiceResult<Project[]>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt));
  return { ok: true, data: rows };
}

export async function update(
  projectId: string,
  data: Partial<Omit<NewProject, "id" | "userId" | "createdAt" | "updatedAt">>,
): Promise<ServiceResult<Project>> {
  const db = getDb();
  const rows = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "项目不存在" } };
  return { ok: true, data: row };
}

export async function remove(projectId: string): Promise<ServiceResult<void>> {
  const db = getDb();
  const rows = await db
    .delete(projects)
    .where(eq(projects.id, projectId))
    .returning({ id: projects.id });
  if (rows.length === 0) return { ok: false, error: { code: "NOT_FOUND", message: "项目不存在" } };
  return { ok: true, data: undefined };
}
