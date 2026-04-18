/**
 * /api/projects/:id/stats — 项目统计数据
 *
 * GET /           — 综合统计（写作进度、API成本、UNM健康）
 * GET /cost       — 成本明细
 * GET /foreshadow — 伏笔追踪看板
 */

import { Hono } from "hono";
import { count, eq, sql, sum } from "drizzle-orm";
import { getDb } from "@moran/core/db";
import { arcs, chapters, decisionLogs, plotThreads, projects } from "@moran/core/db/schema";

/**
 * 写作进度统计
 */
export interface WritingProgress {
  totalWords: number;
  totalChapters: number;
  currentArc: number;
  averageWordsPerChapter: number;
  dailyAverage: number;
  targetWordCount: number;
  completionPercentage: number;
}

/**
 * Agent 成本明细
 */
export interface AgentCost {
  agentId: string;
  agentName: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  invocations: number;
}

/**
 * 成本汇总
 */
export interface CostSummary {
  totalCost: number;
  averageCostPerChapter: number;
  byAgent: AgentCost[];
  /** 最近 7 天每日成本 */
  dailyTrend: Array<{ date: string; cost: number }>;
}

/**
 * UNM 健康状态
 */
export interface UNMHealth {
  hot: number;
  warm: number;
  cold: number;
  total: number;
  /** 各类别分布 */
  byCategory: Record<string, { hot: number; warm: number; cold: number }>;
}

/**
 * 伏笔条目
 */
export interface ForeshadowItem {
  id: string;
  title: string;
  description: string;
  status: "PLANTED" | "DEVELOPING" | "RESOLVED" | "STALE";
  plantedChapter: number;
  resolvedChapter: number | null;
  relatedCharacters: string[];
}

/**
 * 综合统计
 */
export interface ProjectStats {
  progress: WritingProgress;
  cost: CostSummary;
  unm: UNMHealth;
}

const zeroCostSummary = (): CostSummary => ({
  totalCost: 0,
  averageCostPerChapter: 0,
  byAgent: [],
  dailyTrend: [],
});

const mapPlotThreadStatus = (status: string | null | undefined): ForeshadowItem["status"] => {
  switch (status) {
    case "resolved":
      return "RESOLVED";
    case "developing":
      return "DEVELOPING";
    case "stale":
      return "STALE";
    case "planted":
    default:
      return "PLANTED";
  }
};

export function createStatsRoute() {
  const route = new Hono();

  /** GET / — 综合统计 */
  route.get("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const db = getDb();

    const [chapterStats] = await db
      .select({
        totalWords: sql<number>`coalesce(${sum(chapters.wordCount)}, 0)`,
        totalChapters: count(chapters.id),
      })
      .from(chapters)
      .where(eq(chapters.projectId, projectId));

    const [project] = await db
      .select({ targetWordCount: projects.targetWordCount })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    const [arcStats] = await db
      .select({ currentArc: sql<number>`coalesce(max(${arcs.arcIndex}), 0)` })
      .from(arcs)
      .where(eq(arcs.projectId, projectId));

    const totalWords = Number(chapterStats?.totalWords ?? 0);
    const totalChapters = Number(chapterStats?.totalChapters ?? 0);
    const targetWordCount = Number(project?.targetWordCount ?? 0);
    const averageWordsPerChapter = totalChapters > 0 ? Math.round(totalWords / totalChapters) : 0;
    const completionPercentage = targetWordCount > 0 ? Number(((totalWords / targetWordCount) * 100).toFixed(1)) : 0;

    const stats: ProjectStats = {
      progress: {
        totalWords,
        totalChapters,
        currentArc: Number(arcStats?.currentArc ?? 0),
        averageWordsPerChapter,
        dailyAverage: 0,
        targetWordCount,
        completionPercentage,
      },
      cost: zeroCostSummary(),
      unm: {
        hot: 0,
        warm: 0,
        cold: 0,
        total: 0,
        byCategory: {},
      },
    };

    return c.json(stats);
  });

  /** GET /cost — 成本明细 */
  route.get("/cost", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const db = getDb();
    const logs = await db
      .select({
        agentId: decisionLogs.agentId,
        invocations: count(decisionLogs.id),
      })
      .from(decisionLogs)
      .where(eq(decisionLogs.projectId, projectId))
      .groupBy(decisionLogs.agentId);

    const byAgent: AgentCost[] = [];
    for (const row of logs) {
      if (!row.agentId) continue;
      byAgent.push({
        agentId: row.agentId,
        agentName: row.agentId,
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalCost: 0,
        invocations: Number(row.invocations ?? 0),
      });
    }

    const summary: CostSummary = {
      totalCost: 0,
      averageCostPerChapter: 0,
      byAgent,
      dailyTrend: [],
    };

    return c.json(summary);
  });

  /** GET /foreshadow — 伏笔追踪看板 */
  route.get("/foreshadow", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const db = getDb();
    const rows = await db
      .select({
        id: plotThreads.id,
        name: plotThreads.name,
        description: plotThreads.description,
        status: plotThreads.status,
        introducedChapter: plotThreads.introducedChapter,
        resolvedChapter: plotThreads.resolvedChapter,
        relatedCharacterIds: plotThreads.relatedCharacterIds,
      })
      .from(plotThreads)
      .where(eq(plotThreads.projectId, projectId));

    const items: ForeshadowItem[] = rows.map((row) => ({
      id: row.id,
      title: row.name,
      description: row.description ?? "",
      status: mapPlotThreadStatus(row.status),
      plantedChapter: Number(row.introducedChapter ?? 0),
      resolvedChapter: row.resolvedChapter ?? null,
      relatedCharacters: (row.relatedCharacterIds ?? []).map(String),
    }));

    return c.json({ items, total: items.length });
  });

  return route;
}
