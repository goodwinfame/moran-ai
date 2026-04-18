/**
 * /api/projects/:id/diagnosis — 点睛文学诊断路由
 *
 * POST   /                 — 触发文学诊断（指定章节）
 * GET    /                 — 列出项目所有诊断记录
 * GET    /:chapterNum      — 获取特定章节的诊断报告
 */

import { Hono } from "hono";
import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "@moran/core/db";
import { projectDocuments } from "@moran/core/db/schema";
import type { SessionProjectBridge } from "@moran/core";
import { DianjingEngine } from "@moran/core";
import type { DiagnosisInput } from "@moran/core";

// ── Types ──────────────────────────────────────────

export type DiagnosisDimension =
  | "narrative_drive"
  | "emotional_authenticity"
  | "pacing_root_cause"
  | "character_voice"
  | "thematic_coherence";

export const DIAGNOSIS_LABELS: Record<DiagnosisDimension, string> = {
  narrative_drive: "叙事动力",
  emotional_authenticity: "情感真实性",
  pacing_root_cause: "节奏问题溯源",
  character_voice: "角色声音",
  thematic_coherence: "主题一致性",
};

export interface DimensionDiagnosisRecord {
  dimension: DiagnosisDimension;
  label: string;
  severity: number;
  rootCause: string;
  improvementDirection: string;
  evidence?: string;
}

export interface CoreIssueRecord {
  title: string;
  dimensions: DiagnosisDimension[];
  rootCause: string;
  improvementDirection: string;
  impact: number;
}

export interface DiagnosisRecord {
  id: string;
  projectId: string;
  chapterNumber: number;
  dimensionDiagnoses: DimensionDiagnosisRecord[];
  coreIssues: CoreIssueRecord[];
  summary: string;
  createdAt: string;
}

function mapEngineDiagnosisToRecord(
  projectId: string,
  chapterNumber: number,
  diagnosis: {
    dimensionDiagnoses: Array<{
      dimension: DiagnosisDimension;
      severity: number;
      rootCause: string;
      improvementDirection: string;
      evidence?: string;
    }>;
    coreIssues: Array<{
      title: string;
      dimensions: DiagnosisDimension[];
      rootCause: string;
      improvementDirection: string;
      impact: number;
    }>;
    summary: string;
  },
): DiagnosisRecord {
  return {
    id: crypto.randomUUID(),
    projectId,
    chapterNumber,
    dimensionDiagnoses: diagnosis.dimensionDiagnoses.map((item) => ({
      ...item,
      label: DIAGNOSIS_LABELS[item.dimension],
    })),
    coreIssues: diagnosis.coreIssues.map((item) => ({ ...item })),
    summary: diagnosis.summary,
    createdAt: new Date().toISOString(),
  };
}

function parseDiagnosisContent(content: string): DiagnosisRecord | null {
  try {
    return JSON.parse(content) as DiagnosisRecord;
  } catch {
    return null;
  }
}

function toDiagnosisMetadata(record: DiagnosisRecord) {
  return {
    chapterNumber: record.chapterNumber,
    subType: "diagnosis",
  };
}

async function getLatestDiagnosisRow(projectId: string, chapterNum: number) {
  const db = getDb();
  const [row] = await db
    .select({
      id: projectDocuments.id,
      content: projectDocuments.content,
    })
    .from(projectDocuments)
    .where(
      and(
        eq(projectDocuments.projectId, projectId),
        eq(projectDocuments.category, "health_report"),
        sql`${projectDocuments.metadata}->>'subType' = 'diagnosis'`,
        sql`${projectDocuments.metadata}->>'chapterNumber' = ${String(chapterNum)}`,
      ),
    )
    .orderBy(desc(projectDocuments.createdAt));

  return row ?? null;
}

async function upsertDiagnosisDocument(projectId: string, record: DiagnosisRecord, existingId?: string) {
  const db = getDb();
  const values = {
    projectId,
    category: "health_report" as const,
    title: `diagnosis:ch${record.chapterNumber}`,
    content: JSON.stringify(record),
    metadata: toDiagnosisMetadata(record),
  };

  if (existingId) {
    const [updated] = await db
      .update(projectDocuments)
      .set(values)
      .where(eq(projectDocuments.id, existingId))
      .returning({ id: projectDocuments.id });

    if (!updated) {
      return null;
    }

    return updated.id;
  }

  const [created] = await db
    .insert(projectDocuments)
    .values(values)
    .returning({ id: projectDocuments.id });

  if (!created) {
    return null;
  }

  return created.id;
}

// ── Route factory ────────────────────────────────

export function createDiagnosisRoute(bridge: SessionProjectBridge, dianjingEngine: DianjingEngine) {
  const route = new Hono();

  /** GET / — 列出所有诊断记录 */
  route.get("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const db = getDb();
    const rows = await db
      .select({
        content: projectDocuments.content,
      })
      .from(projectDocuments)
      .where(
        and(
          eq(projectDocuments.projectId, projectId),
          eq(projectDocuments.category, "health_report"),
          sql`${projectDocuments.metadata}->>'subType' = 'diagnosis'`,
        ),
      )
      .orderBy(desc(projectDocuments.createdAt));

    const records = rows
      .map((row) => parseDiagnosisContent(row.content))
      .filter((record): record is DiagnosisRecord => record !== null)
      .sort((a, b) => a.chapterNumber - b.chapterNumber);

    return c.json({
      diagnoses: records.map((r) => ({
        id: r.id,
        chapterNumber: r.chapterNumber,
        coreIssueCount: r.coreIssues.length,
        topIssueSeverity: Math.max(...r.dimensionDiagnoses.map((d) => d.severity), 0),
        summary: r.summary,
        createdAt: r.createdAt,
      })),
      total: records.length,
    });
  });

  /** GET /:chapterNum — 获取特定章节的诊断报告 */
  route.get("/:chapterNum", async (c) => {
    const projectId = c.req.param("id");
    const chapterNum = parseInt(c.req.param("chapterNum"), 10);

    if (!projectId || isNaN(chapterNum)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    const row = await getLatestDiagnosisRow(projectId, chapterNum);
    if (!row) {
      return c.json({ error: "Diagnosis not found" }, 404);
    }

    const record = parseDiagnosisContent(row.content);
    if (!record) {
      return c.json({ error: "Diagnosis data is corrupted" }, 500);
    }

    return c.json(record);
  });

  /** POST / — 触发文学诊断 */
  route.post("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const body = await c
      .req
      .json<{
        chapterNumber: number;
        content?: string;
        reviewSummary?: string;
        characterProfiles?: string;
        previousSummary?: string;
        themeDescription?: string;
      }>()
      .catch(() => null);
    if (!body || typeof body.chapterNumber !== "number") {
      return c.json({ error: "chapterNumber is required" }, 400);
    }

    const record = body.content
      ? await (async () => {
          const content = body.content as string; // narrowed by ternary guard above
          await bridge.ensureSession(projectId);
          return mapEngineDiagnosisToRecord(
            projectId,
            body.chapterNumber,
            await dianjingEngine.diagnose(
              {
                content,
                chapterNumber: body.chapterNumber,
                reviewSummary: body.reviewSummary,
                characterProfiles: body.characterProfiles,
                previousSummary: body.previousSummary,
                themeDescription: body.themeDescription,
              } satisfies DiagnosisInput,
              bridge,
            ),
          );
        })()
      : {
          id: crypto.randomUUID(),
          projectId,
          chapterNumber: body.chapterNumber,
          dimensionDiagnoses: [],
          coreIssues: [],
          summary: "等待章节内容",
          createdAt: new Date().toISOString(),
        };

    const savedId = await upsertDiagnosisDocument(projectId, record);
    if (!savedId) {
      return c.json({ error: "Failed to create diagnosis" }, 500);
    }

    return c.json(record, 201);
  });

  return route;
}
