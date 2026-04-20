import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { projectDocuments } from "../db/schema/documents.js";
import type { ServiceResult } from "./types.js";

type Document = typeof projectDocuments.$inferSelect;

const CATEGORY = "analysis" as const;

export interface AnalysisResult {
  scope: "chapter" | "arc" | "full";
  range?: { start: number; end: number };
  dimensions: Record<
    string,
    {
      score: number;
      analysis: string;
      trend?: "improving" | "stable" | "declining";
      suggestions: string[];
    }
  >;
  overall: number;
  topIssues: string[];
}

export interface TrendPoint {
  id: string;
  scope: string;
  overall: number;
  createdAt: Date;
}

export async function save(
  projectId: string,
  data: AnalysisResult,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rangeStr = data.range ? `${data.range.start}-${data.range.end}` : "full";
  const title = `Analysis ${data.scope} ${rangeStr}`;
  const content = JSON.stringify(data);
  const metadata = {
    scope: data.scope,
    range: data.range,
    overall: data.overall,
    topIssues: data.topIssues,
  };

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
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "分析报告保存失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function read(
  projectId: string,
  analysisId: string,
): Promise<ServiceResult<Document>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(projectDocuments)
    .where(
      and(
        eq(projectDocuments.id, analysisId),
        eq(projectDocuments.projectId, projectId),
        eq(projectDocuments.category, CATEGORY),
      ),
    )
    .limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "分析报告不存在" } };
  return { ok: true, data: row };
}

export async function list(
  projectId: string,
  filters?: { scope?: string; latest?: boolean },
): Promise<ServiceResult<Document[]>> {
  const db = getDb();
  const scopeFilter = filters?.scope
    ? sql`${projectDocuments.metadata}->>'scope' = ${filters.scope}`
    : undefined;
  const rows = await db
    .select()
    .from(projectDocuments)
    .where(
      and(
        eq(projectDocuments.projectId, projectId),
        eq(projectDocuments.category, CATEGORY),
        scopeFilter,
      ),
    )
    .orderBy(desc(projectDocuments.createdAt));
  if (filters?.latest) {
    return { ok: true, data: rows.slice(0, 1) };
  }
  return { ok: true, data: rows };
}

export async function trend(projectId: string): Promise<ServiceResult<TrendPoint[]>> {
  const db = getDb();
  const rows = await db
    .select({
      id: projectDocuments.id,
      metadata: projectDocuments.metadata,
      createdAt: projectDocuments.createdAt,
    })
    .from(projectDocuments)
    .where(
      and(
        eq(projectDocuments.projectId, projectId),
        eq(projectDocuments.category, CATEGORY),
      ),
    )
    .orderBy(projectDocuments.createdAt);
  const trendPoints = rows.map((r) => {
    const meta = r.metadata as { scope?: string; overall?: number } | null;
    return {
      id: r.id,
      scope: meta?.scope ?? "full",
      overall: meta?.overall ?? 0,
      createdAt: r.createdAt ?? new Date(),
    };
  });
  return { ok: true, data: trendPoints };
}
