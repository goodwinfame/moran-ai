/**
 * /api/projects/:id/analysis — 析典分析任务路由
 *
 * POST   /                    — 提交新分析任务
 * GET    /                    — 列出项目所有分析记录
 * GET    /:analysisId         — 获取分析详情（含九维报告）
 * POST   /:analysisId/settle  — 将分析中提取的技法沉淀到知识库
 * GET    /compare             — 多作品同维度对比
 * GET    /:analysisId/export  — 导出分析报告（Markdown）
 */

import { Hono } from "hono";
import { eq, and, desc, sql } from "drizzle-orm";
import type { AnalysisInput, SessionProjectBridge } from "@moran/core";
import { XidianEngine } from "@moran/core";
import { createLogger } from "@moran/core/logger";
import { getDb } from "@moran/core/db";
import { projectDocuments } from "@moran/core/db/schema";

const log = createLogger("analysis-routes");

// ── Types ──────────────────────────────────────────

/** 九大分析维度 */
export type AnalysisDimension =
  | "narrative_structure"
  | "character_design"
  | "world_building"
  | "foreshadowing"
  | "pacing_tension"
  | "shuanggan_mechanics"
  | "style_fingerprint"
  | "dialogue_voice"
  | "chapter_hooks";

export const DIMENSION_LABELS: Record<AnalysisDimension, string> = {
  narrative_structure: "① 叙事结构分析",
  character_design: "② 角色设计技法",
  world_building: "③ 世界观构建",
  foreshadowing: "④ 伏笔与线索",
  pacing_tension: "⑤ 节奏与张力",
  shuanggan_mechanics: "⑥ 爽感机制",
  style_fingerprint: "⑦ 文风指纹",
  dialogue_voice: "⑧ 对话与声音",
  chapter_hooks: "⑨ 章末钩子",
};

export const ALL_DIMENSIONS: AnalysisDimension[] = [
  "narrative_structure",
  "character_design",
  "world_building",
  "foreshadowing",
  "pacing_tension",
  "shuanggan_mechanics",
  "style_fingerprint",
  "dialogue_voice",
  "chapter_hooks",
];

/** 维度分析结果 */
export interface DimensionResult {
  dimension: AnalysisDimension;
  label: string;
  /** Markdown 格式分析内容 */
  content: string;
  /** 可操作建议 */
  actionableInsights: string[];
  /** 适用的消费方 Agent */
  consumers: string[];
}

/** 提取的写作技法 */
export interface WritingTechnique {
  id: string;
  title: string;
  description: string;
  /** 来源维度 */
  sourceDimension: AnalysisDimension;
  /** 分类 */
  category: "writing_technique" | "genre_knowledge" | "style_guide" | "reference_analysis";
  /** 是否已沉淀到知识库 */
  settled: boolean;
}

/** 作品元数据 */
export interface WorkMetadata {
  title: string;
  author: string;
  tags: string[];
  synopsis: string;
  wordCount?: number;
  rating?: number;
  platform?: string;
}

/** 分析任务状态 */
export type AnalysisStatus = "pending" | "searching" | "analyzing" | "reporting" | "settling" | "completed" | "failed";

/** 分析进度 */
export interface AnalysisProgressData {
  stage: "search" | "analyze" | "report" | "settle";
  dimension?: AnalysisDimension;
  message: string;
  /** 0-1 */
  progress: number;
  /** 已完成的维度 */
  completedDimensions: AnalysisDimension[];
}

/** 提交分析的请求体 */
export interface SubmitAnalysisRequest {
  workTitle: string;
  authorName?: string;
  userNotes?: string;
  /** 粘贴的文本片段 */
  providedTexts?: string[];
  /** 指定分析维度（默认全部九维） */
  dimensions?: AnalysisDimension[];
}

/** 分析任务记录 */
export interface AnalysisRecord {
  id: string;
  projectId: string;
  /** 作品信息 */
  work: WorkMetadata;
  /** 分析状态 */
  status: AnalysisStatus;
  /** 各维度分析结果 */
  dimensions: DimensionResult[];
  /** 提取的写作技法 */
  techniques: WritingTechnique[];
  /** 综合摘要 */
  overallSummary: string;
  /** 分析进度 */
  progress: AnalysisProgressData;
  /** LLM 用量 */
  totalUsage: { inputTokens: number; outputTokens: number };
  createdAt: string;
  updatedAt: string;
}

/** 对比视图请求 */
export interface CompareRequest {
  analysisIds: string[];
  dimension: AnalysisDimension;
}

/** 对比条目 */
export interface CompareEntry {
  analysisId: string;
  workTitle: string;
  dimension: AnalysisDimension;
  label: string;
  content: string;
  actionableInsights: string[];
}

// ── DB helpers ────────────────────────────────────

function parseAnalysisContent(content: string): AnalysisRecord | null {
  try {
    return JSON.parse(content) as AnalysisRecord;
  } catch {
    return null;
  }
}

function toAnalysisMetadata(record: AnalysisRecord) {
  return {
    workTitle: record.work.title,
    author: record.work.author,
    status: record.status,
    subType: "analysis",
    analysisId: record.id,
  };
}

async function getAnalysisRow(projectId: string, analysisId: string) {
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
        eq(projectDocuments.category, "analysis"),
        sql`${projectDocuments.metadata}->>'subType' = 'analysis'`,
        sql`${projectDocuments.metadata}->>'analysisId' = ${analysisId}`,
      ),
    )
    .orderBy(desc(projectDocuments.createdAt));

  return row ?? null;
}

async function upsertAnalysisDocument(projectId: string, record: AnalysisRecord, existingId?: string) {
  const db = getDb();
  const values = {
    projectId,
    category: "analysis" as const,
    title: `analysis:${record.work.title}`,
    content: JSON.stringify(record),
    metadata: toAnalysisMetadata(record),
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

export function createAnalysisRoute(bridge: SessionProjectBridge, xidianEngine: XidianEngine) {
  const route = new Hono();

  /** GET / — 列出所有分析记录 */
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
          eq(projectDocuments.category, "analysis"),
          sql`${projectDocuments.metadata}->>'subType' = 'analysis'`,
        ),
      )
      .orderBy(desc(projectDocuments.createdAt));

    const analyses = rows
      .map((row) => parseAnalysisContent(row.content))
      .filter((r): r is AnalysisRecord => r !== null);

    return c.json({
      analyses: analyses.map((r) => ({
        id: r.id,
        workTitle: r.work.title,
        author: r.work.author,
        status: r.status,
        dimensionCount: r.dimensions.length,
        techniqueCount: r.techniques.length,
        createdAt: r.createdAt,
      })),
      total: analyses.length,
    });
  });

  /** GET /compare — 多作品同维度对比 */
  route.get("/compare", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const ids = c.req.query("ids")?.split(",") ?? [];
    const dimension = c.req.query("dimension") as AnalysisDimension | undefined;

    if (ids.length < 2 || !dimension) {
      return c.json({ error: "Need at least 2 analysis IDs and a dimension" }, 400);
    }

    const entries: CompareEntry[] = [];
    for (const aId of ids) {
      const row = await getAnalysisRow(projectId, aId);
      if (!row) continue;

      const record = parseAnalysisContent(row.content);
      if (!record) continue;

      const dimResult = record.dimensions.find((d) => d.dimension === dimension);
      if (dimResult) {
        entries.push({
          analysisId: aId,
          workTitle: record.work.title,
          dimension: dimResult.dimension,
          label: dimResult.label,
          content: dimResult.content,
          actionableInsights: dimResult.actionableInsights,
        });
      }
    }

    return c.json({ entries, dimension, label: DIMENSION_LABELS[dimension] });
  });

  /** GET /:analysisId — 获取分析详情 */
  route.get("/:analysisId", async (c) => {
    const projectId = c.req.param("id");
    const analysisId = c.req.param("analysisId");
    if (!projectId || !analysisId) {
      return c.json({ error: "Missing project ID or analysis ID" }, 400);
    }

    const row = await getAnalysisRow(projectId, analysisId);
    if (!row) {
      return c.json({ error: "Analysis not found" }, 404);
    }

    const record = parseAnalysisContent(row.content);
    if (!record) {
      return c.json({ error: "Analysis data is corrupted" }, 500);
    }

    return c.json(record);
  });

  /** POST / — 提交新分析任务 */
  route.post("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const body = await c.req.json<SubmitAnalysisRequest>();
    if (!body.workTitle?.trim()) {
      return c.json({ error: "workTitle is required" }, 400);
    }

    const now = new Date().toISOString();
    const record: AnalysisRecord = {
      id: crypto.randomUUID(),
      projectId,
      work: {
        title: body.workTitle.trim(),
        author: body.authorName ?? "未知作者",
        tags: [],
        synopsis: "",
      },
      status: "pending",
      dimensions: [],
      techniques: [],
      overallSummary: "",
      progress: {
        stage: "search",
        message: "等待分析",
        progress: 0,
        completedDimensions: [],
      },
      totalUsage: { inputTokens: 0, outputTokens: 0 },
      createdAt: now,
      updatedAt: now,
    };

    const savedId = await upsertAnalysisDocument(projectId, record);
    if (!savedId) {
      return c.json({ error: "Failed to create analysis" }, 500);
    }

    const analysisInput: AnalysisInput = {
      projectId,
      workTitle: body.workTitle.trim(),
      authorName: body.authorName,
      userNotes: body.userNotes,
      providedTexts: body.providedTexts,
      dimensions: body.dimensions,
    };

    await bridge.ensureSession(projectId);

    void xidianEngine
      .analyzeWork(analysisInput, bridge, (progress) => {
        log.info(
          { analysisId: record.id, stage: progress.stage, progress: progress.progress },
          "Analysis progress",
        );
      })
      .then(async ({ report, settlement }) => {
        const updatedRecord: AnalysisRecord = {
          ...record,
          status: "completed",
          dimensions: report.dimensions.map((d) => ({
            dimension: d.dimension as AnalysisDimension,
            label: DIMENSION_LABELS[d.dimension as AnalysisDimension] ?? d.dimension,
            content: d.content,
            actionableInsights: d.actionableInsights,
            consumers: d.consumers ?? [],
          })),
          techniques: (settlement?.entries ?? []).map((e) => ({
            id: crypto.randomUUID(),
            title: e.title,
            description: e.content,
            sourceDimension: (e.sourceDimension ?? "narrative_structure") as AnalysisDimension,
            category: (e.category ?? "writing_technique") as WritingTechnique["category"],
            settled: false,
          })),
          overallSummary: report.overallSummary,
          progress: {
            stage: "settle",
            message: "分析完成",
            progress: 1,
            completedDimensions: report.dimensions.map((d) => d.dimension as AnalysisDimension),
          },
          totalUsage: report.totalUsage ?? { inputTokens: 0, outputTokens: 0 },
          updatedAt: new Date().toISOString(),
        };
        await upsertAnalysisDocument(projectId, updatedRecord, savedId);
        log.info({ analysisId: record.id }, "Analysis completed and saved");
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        log.error({ error: message, analysisId: record.id }, "Analysis failed");
        const failedRecord: AnalysisRecord = {
          ...record,
          status: "failed",
          overallSummary: `分析失败: ${message}`,
          updatedAt: new Date().toISOString(),
        };
        upsertAnalysisDocument(projectId, failedRecord, savedId).catch(() => {});
      });

    return c.json(record, 202);
  });

  /** POST /:analysisId/settle — 沉淀技法到知识库 */
  route.post("/:analysisId/settle", async (c) => {
    const projectId = c.req.param("id");
    const analysisId = c.req.param("analysisId");
    if (!projectId || !analysisId) {
      return c.json({ error: "Missing project ID or analysis ID" }, 400);
    }

    const row = await getAnalysisRow(projectId, analysisId);
    if (!row) {
      return c.json({ error: "Analysis not found" }, 404);
    }

    const record = parseAnalysisContent(row.content);
    if (!record) {
      return c.json({ error: "Analysis data is corrupted" }, 500);
    }

    const body = await c.req.json<{ techniqueIds?: string[] }>().catch(() => ({} as { techniqueIds?: string[] }));
    const techniqueIds = body.techniqueIds;

    let settledCount = 0;
    for (const tech of record.techniques) {
      if (!techniqueIds || techniqueIds.includes(tech.id)) {
        if (!tech.settled) {
          tech.settled = true;
          settledCount++;
        }
      }
    }

    record.updatedAt = new Date().toISOString();

    const savedId = await upsertAnalysisDocument(projectId, record, row.id);
    if (!savedId) {
      return c.json({ error: "Failed to update analysis" }, 500);
    }

    return c.json({ settledCount, totalTechniques: record.techniques.length });
  });

  /** GET /:analysisId/export — 导出分析报告（Markdown） */
  route.get("/:analysisId/export", async (c) => {
    const projectId = c.req.param("id");
    const analysisId = c.req.param("analysisId");
    if (!projectId || !analysisId) {
      return c.json({ error: "Missing project ID or analysis ID" }, 400);
    }

    const row = await getAnalysisRow(projectId, analysisId);
    if (!row) {
      return c.json({ error: "Analysis not found" }, 404);
    }

    const record = parseAnalysisContent(row.content);
    if (!record) {
      return c.json({ error: "Analysis data is corrupted" }, 500);
    }

    const md = exportToMarkdown(record);

    const encodedName = encodeURIComponent(`${record.work.title}-analysis.md`);
    c.header("Content-Type", "text/markdown; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename*=UTF-8''${encodedName}`);
    return c.body(md);
  });

  return route;
}

// ── Export helper ────────────────────────────────

function exportToMarkdown(record: AnalysisRecord): string {
  const lines: string[] = [];

  lines.push(`# 《${record.work.title}》九维分析报告`);
  lines.push("");
  lines.push(`> 作者：${record.work.author} | 分析时间：${record.createdAt}`);
  lines.push(`> 标签：${record.work.tags.join("、")} | 评分：${record.work.rating ?? "N/A"}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Overall summary
  lines.push(record.overallSummary);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Each dimension
  for (const dim of record.dimensions) {
    lines.push(dim.content);
    lines.push("");
    if (dim.actionableInsights.length > 0) {
      lines.push("**可操作建议：**");
      for (const insight of dim.actionableInsights) {
        lines.push(`- ${insight}`);
      }
      lines.push("");
    }
    lines.push("---");
    lines.push("");
  }

  // Techniques
  if (record.techniques.length > 0) {
    lines.push("## 提取的写作技法");
    lines.push("");
    for (const tech of record.techniques) {
      lines.push(`### ${tech.title}`);
      lines.push("");
      lines.push(tech.description);
      lines.push("");
      lines.push(`_来源维度：${DIMENSION_LABELS[tech.sourceDimension]}_`);
      lines.push("");
    }
  }

  // Usage
  lines.push("---");
  lines.push("");
  lines.push(`_总用量：输入 ${record.totalUsage.inputTokens.toLocaleString()} tokens，输出 ${record.totalUsage.outputTokens.toLocaleString()} tokens_`);

  return lines.join("\n");
}
