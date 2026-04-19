import { eq, and, sql, desc } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { chapters, chapterVersions, chapterBriefs } from "../db/schema/chapters.js";
import type { ServiceResult } from "./types.js";

type Chapter = typeof chapters.$inferSelect;
type NewChapter = typeof chapters.$inferInsert;
type Version = typeof chapterVersions.$inferSelect;
type NewVersion = typeof chapterVersions.$inferInsert;
type Brief = typeof chapterBriefs.$inferSelect;
type NewBrief = typeof chapterBriefs.$inferInsert;

// ── Chapters ──

export async function create(
  projectId: string,
  data: Omit<NewChapter, "id" | "projectId" | "createdAt" | "updatedAt">,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db
    .insert(chapters)
    .values({ projectId, ...data })
    .returning({ id: chapters.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "章节创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function read(
  projectId: string,
  chapterNumber: number,
): Promise<ServiceResult<Chapter>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(chapters)
    .where(and(eq(chapters.projectId, projectId), eq(chapters.chapterNumber, chapterNumber)))
    .limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "章节不存在" } };
  return { ok: true, data: row };
}

export async function readById(id: string): Promise<ServiceResult<Chapter>> {
  const db = getDb();
  const [row] = await db.select().from(chapters).where(eq(chapters.id, id)).limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "章节不存在" } };
  return { ok: true, data: row };
}

export async function list(projectId: string): Promise<ServiceResult<Chapter[]>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(chapters)
    .where(eq(chapters.projectId, projectId))
    .orderBy(chapters.chapterNumber);
  return { ok: true, data: rows };
}

export async function update(
  id: string,
  data: Partial<Omit<NewChapter, "id" | "projectId" | "createdAt" | "updatedAt">>,
): Promise<ServiceResult<Chapter>> {
  const db = getDb();
  const updates = { ...data, updatedAt: new Date() };
  if (data.content !== undefined) {
    (updates as Record<string, unknown>).currentVersion =
      sql`coalesce(${chapters.currentVersion}, 0) + 1`;
  }
  const rows = await db.update(chapters).set(updates).where(eq(chapters.id, id)).returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "章节不存在" } };
  return { ok: true, data: row };
}

export async function patch(
  id: string,
  data: {
    title?: string;
    content?: string;
    wordCount?: number;
    writerStyle?: string;
    status?: NewChapter["status"];
  },
): Promise<ServiceResult<Chapter>> {
  const db = getDb();
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) updates[key] = value;
  }
  if (Object.keys(updates).length === 0) {
    return { ok: false, error: { code: "NO_FIELDS", message: "没有需要更新的字段" } };
  }
  updates.updatedAt = new Date();
  const rows = await db.update(chapters).set(updates).where(eq(chapters.id, id)).returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "章节不存在" } };
  return { ok: true, data: row };
}

export async function archive(id: string): Promise<ServiceResult<Chapter>> {
  const db = getDb();
  const [chapter] = await db.select().from(chapters).where(eq(chapters.id, id)).limit(1);
  if (!chapter) return { ok: false, error: { code: "NOT_FOUND", message: "章节不存在" } };

  // Save current content as a version snapshot
  if (chapter.content) {
    await db.insert(chapterVersions).values({
      chapterId: id,
      version: chapter.currentVersion ?? 1,
      content: chapter.content,
      wordCount: chapter.wordCount,
      reason: "archive",
    });
  }

  const rows = await db
    .update(chapters)
    .set({
      status: "archived",
      archivedVersion: chapter.currentVersion,
      updatedAt: new Date(),
    })
    .where(eq(chapters.id, id))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "UPDATE_FAILED", message: "归档失败" } };
  return { ok: true, data: row };
}

// ── Chapter Versions ──

export async function createVersion(
  chapterId: string,
  data: Omit<NewVersion, "id" | "chapterId" | "createdAt">,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db
    .insert(chapterVersions)
    .values({ chapterId, ...data })
    .returning({ id: chapterVersions.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "版本创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function listVersions(chapterId: string): Promise<ServiceResult<Version[]>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(chapterVersions)
    .where(eq(chapterVersions.chapterId, chapterId))
    .orderBy(desc(chapterVersions.version));
  return { ok: true, data: rows };
}

// ── Chapter Briefs ──

export async function createBrief(
  projectId: string,
  data: Omit<NewBrief, "id" | "projectId" | "createdAt" | "updatedAt">,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db
    .insert(chapterBriefs)
    .values({ projectId, ...data })
    .returning({ id: chapterBriefs.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "章节详案创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function readBrief(
  projectId: string,
  chapterNumber: number,
): Promise<ServiceResult<Brief>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(chapterBriefs)
    .where(
      and(eq(chapterBriefs.projectId, projectId), eq(chapterBriefs.chapterNumber, chapterNumber)),
    )
    .limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "章节详案不存在" } };
  return { ok: true, data: row };
}

export async function updateBrief(
  id: string,
  data: Partial<Omit<NewBrief, "id" | "projectId" | "createdAt" | "updatedAt">>,
): Promise<ServiceResult<Brief>> {
  const db = getDb();
  const rows = await db
    .update(chapterBriefs)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(chapterBriefs.id, id))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "章节详案不存在" } };
  return { ok: true, data: row };
}
