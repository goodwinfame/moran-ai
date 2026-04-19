import { eq, and } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { chapterSummaries, arcSummaries } from "../db/schema/summaries.js";
import type { ServiceResult } from "./types.js";

type ChapterSummary = typeof chapterSummaries.$inferSelect;
type ArcSummary = typeof arcSummaries.$inferSelect;

// ── Chapter Summaries ──

export async function createChapterSummary(
  projectId: string,
  data: { chapterNumber: number; content: string },
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db
    .insert(chapterSummaries)
    .values({ projectId, ...data })
    .returning({ id: chapterSummaries.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "章节摘要创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function readChapterSummary(
  projectId: string,
  chapterNumber: number,
): Promise<ServiceResult<ChapterSummary>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(chapterSummaries)
    .where(
      and(
        eq(chapterSummaries.projectId, projectId),
        eq(chapterSummaries.chapterNumber, chapterNumber),
      ),
    )
    .limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "章节摘要不存在" } };
  return { ok: true, data: row };
}

export async function listChapterSummaries(
  projectId: string,
): Promise<ServiceResult<ChapterSummary[]>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(chapterSummaries)
    .where(eq(chapterSummaries.projectId, projectId))
    .orderBy(chapterSummaries.chapterNumber);
  return { ok: true, data: rows };
}

// ── Arc Summaries ──

export async function createArcSummary(
  projectId: string,
  data: { arcIndex: number; content: string },
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db
    .insert(arcSummaries)
    .values({ projectId, ...data })
    .returning({ id: arcSummaries.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "弧段摘要创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function readArcSummary(
  projectId: string,
  arcIndex: number,
): Promise<ServiceResult<ArcSummary>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(arcSummaries)
    .where(and(eq(arcSummaries.projectId, projectId), eq(arcSummaries.arcIndex, arcIndex)))
    .limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "弧段摘要不存在" } };
  return { ok: true, data: row };
}

export async function listArcSummaries(projectId: string): Promise<ServiceResult<ArcSummary[]>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(arcSummaries)
    .where(eq(arcSummaries.projectId, projectId))
    .orderBy(arcSummaries.arcIndex);
  return { ok: true, data: rows };
}
