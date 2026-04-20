import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { projectDocuments } from "../db/schema/documents.js";
import type { ServiceResult } from "./types.js";

type Document = typeof projectDocuments.$inferSelect;

const CATEGORY = "review" as const;

export interface ReviewRoundResult {
  passed: boolean;
  score?: number;
  metrics?: Record<string, number>;
  issues: Array<{
    issue: string;
    severity: "critical" | "major" | "minor" | "suggestion";
    evidence: string;
    suggestion: string;
    expectedEffect: string;
  }>;
}

export async function saveRound(
  projectId: string,
  chapterNumber: number,
  round: 1 | 2 | 3 | 4,
  result: ReviewRoundResult,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const title = `Review Ch.${chapterNumber} Round ${round}`;
  const content = JSON.stringify(result);
  const metadata = {
    chapterNumber,
    round,
    passed: result.passed,
    score: result.score,
    metrics: result.metrics,
  };

  const [existing] = await db
    .select({ id: projectDocuments.id })
    .from(projectDocuments)
    .where(
      and(
        eq(projectDocuments.projectId, projectId),
        eq(projectDocuments.category, CATEGORY),
        sql`${projectDocuments.metadata}->>'chapterNumber' = ${String(chapterNumber)}`,
        sql`${projectDocuments.metadata}->>'round' = ${String(round)}`,
      ),
    )
    .limit(1);

  if (existing) {
    const rows = await db
      .update(projectDocuments)
      .set({
        title,
        content,
        metadata,
        version: sql`coalesce(${projectDocuments.version}, 0) + 1`,
      })
      .where(eq(projectDocuments.id, existing.id))
      .returning({ id: projectDocuments.id });
    const row = rows[0];
    if (!row) return { ok: false, error: { code: "UPDATE_FAILED", message: "审校轮次更新失败" } };
    return { ok: true, data: { id: row.id } };
  }

  const rows = await db
    .insert(projectDocuments)
    .values({
      projectId,
      category: CATEGORY,
      title,
      content,
      metadata,
    })
    .returning({ id: projectDocuments.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "审校轮次保存失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function readRound(
  projectId: string,
  chapterNumber: number,
  round: 1 | 2 | 3 | 4,
): Promise<ServiceResult<Document>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(projectDocuments)
    .where(
      and(
        eq(projectDocuments.projectId, projectId),
        eq(projectDocuments.category, CATEGORY),
        sql`${projectDocuments.metadata}->>'chapterNumber' = ${String(chapterNumber)}`,
        sql`${projectDocuments.metadata}->>'round' = ${String(round)}`,
      ),
    )
    .limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "审校记录不存在" } };
  return { ok: true, data: row };
}

export async function readByChapter(
  projectId: string,
  chapterNumber: number,
): Promise<ServiceResult<Document[]>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(projectDocuments)
    .where(
      and(
        eq(projectDocuments.projectId, projectId),
        eq(projectDocuments.category, CATEGORY),
        sql`${projectDocuments.metadata}->>'chapterNumber' = ${String(chapterNumber)}`,
      ),
    )
    .orderBy(sql`(${projectDocuments.metadata}->>'round')::int asc`);
  return { ok: true, data: rows };
}

export async function list(projectId: string): Promise<ServiceResult<Document[]>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(projectDocuments)
    .where(
      and(
        eq(projectDocuments.projectId, projectId),
        eq(projectDocuments.category, CATEGORY),
      ),
    )
    .orderBy(desc(projectDocuments.createdAt));
  return { ok: true, data: rows };
}

export async function isChapterPassed(
  projectId: string,
  chapterNumber: number,
): Promise<ServiceResult<{ passed: boolean; completedRounds: number }>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(projectDocuments)
    .where(
      and(
        eq(projectDocuments.projectId, projectId),
        eq(projectDocuments.category, CATEGORY),
        sql`${projectDocuments.metadata}->>'chapterNumber' = ${String(chapterNumber)}`,
      ),
    )
    .orderBy(sql`(${projectDocuments.metadata}->>'round')::int asc`);
  const completedRounds = rows.length;
  const passed =
    completedRounds === 4 &&
    rows.every((r) => {
      const meta = r.metadata as { passed?: boolean } | null;
      return meta?.passed === true;
    });
  return { ok: true, data: { passed, completedRounds } };
}
