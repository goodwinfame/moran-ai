import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { projectDocuments } from "../db/schema/documents.js";
import type { ServiceResult } from "./types.js";

type Document = typeof projectDocuments.$inferSelect;

const CATEGORY = "brainstorm" as const;

export async function create(
  projectId: string,
  data: { title?: string; content: string; metadata?: unknown },
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db
    .insert(projectDocuments)
    .values({
      projectId,
      category: CATEGORY,
      title: data.title,
      content: data.content,
      metadata: data.metadata,
    })
    .returning({ id: projectDocuments.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "脑暴文档创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function read(
  projectId: string,
  id: string,
): Promise<ServiceResult<Document>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(projectDocuments)
    .where(
      and(
        eq(projectDocuments.id, id),
        eq(projectDocuments.projectId, projectId),
        eq(projectDocuments.category, CATEGORY),
      ),
    )
    .limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "脑暴文档不存在" } };
  return { ok: true, data: row };
}

export async function list(projectId: string): Promise<ServiceResult<Document[]>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(projectDocuments)
    .where(and(eq(projectDocuments.projectId, projectId), eq(projectDocuments.category, CATEGORY)))
    .orderBy(desc(projectDocuments.createdAt));
  return { ok: true, data: rows };
}

export async function update(
  id: string,
  data: { title?: string; content: string; metadata?: unknown },
): Promise<ServiceResult<Document>> {
  const db = getDb();
  const rows = await db
    .update(projectDocuments)
    .set({
      title: data.title,
      content: data.content,
      metadata: data.metadata,
      version: sql`coalesce(${projectDocuments.version}, 0) + 1`,
    })
    .where(and(eq(projectDocuments.id, id), eq(projectDocuments.category, CATEGORY)))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "脑暴文档不存在" } };
  return { ok: true, data: row };
}

export async function patch(
  id: string,
  data: { title?: string; content?: string; isPinned?: boolean; metadata?: unknown },
): Promise<ServiceResult<Document>> {
  const db = getDb();
  const updates: Record<string, unknown> = {};
  if (data.title !== undefined) updates.title = data.title;
  if (data.content !== undefined) {
    updates.content = data.content;
    updates.version = sql`coalesce(${projectDocuments.version}, 0) + 1`;
  }
  if (data.isPinned !== undefined) updates.isPinned = data.isPinned;
  if (data.metadata !== undefined) updates.metadata = data.metadata;

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: { code: "NO_FIELDS", message: "没有需要更新的字段" } };
  }

  const rows = await db
    .update(projectDocuments)
    .set(updates)
    .where(and(eq(projectDocuments.id, id), eq(projectDocuments.category, CATEGORY)))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "脑暴文档不存在" } };
  return { ok: true, data: row };
}
