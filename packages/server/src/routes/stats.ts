/**
 * /api/projects/:id/stats — 项目统计数据
 *
 * GET /           — 综合统计（写作进度、API成本、UNM健康）
 * GET /cost       — 成本明细
 * GET /foreshadow — 伏笔追踪看板
 */

import { Hono } from "hono";

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

// ── Demo data generators ────────────────────────────────

function demoProgress(): WritingProgress {
  return {
    totalWords: 128_450,
    totalChapters: 42,
    currentArc: 2,
    averageWordsPerChapter: 3058,
    dailyAverage: 6400,
    targetWordCount: 500_000,
    completionPercentage: 25.7,
  };
}

function demoCost(): CostSummary {
  const byAgent: AgentCost[] = [
    {
      agentId: "zhibi",
      agentName: "执笔",
      totalTokens: 2_450_000,
      promptTokens: 1_800_000,
      completionTokens: 650_000,
      totalCost: 12.35,
      invocations: 42,
    },
    {
      agentId: "mingjing",
      agentName: "明镜",
      totalTokens: 1_200_000,
      promptTokens: 980_000,
      completionTokens: 220_000,
      totalCost: 5.80,
      invocations: 56,
    },
    {
      agentId: "lingxi",
      agentName: "灵犀",
      totalTokens: 800_000,
      promptTokens: 600_000,
      completionTokens: 200_000,
      totalCost: 3.20,
      invocations: 42,
    },
    {
      agentId: "zaishi",
      agentName: "载史",
      totalTokens: 600_000,
      promptTokens: 450_000,
      completionTokens: 150_000,
      totalCost: 2.40,
      invocations: 42,
    },
    {
      agentId: "jiangxin",
      agentName: "匠心",
      totalTokens: 350_000,
      promptTokens: 280_000,
      completionTokens: 70_000,
      totalCost: 1.05,
      invocations: 14,
    },
  ];

  const today = new Date();
  const dailyTrend: Array<{ date: string; cost: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dailyTrend.push({
      date: d.toISOString().slice(0, 10),
      cost: +(Math.random() * 3 + 1.5).toFixed(2),
    });
  }

  return {
    totalCost: byAgent.reduce((s, a) => s + a.totalCost, 0),
    averageCostPerChapter: +(byAgent.reduce((s, a) => s + a.totalCost, 0) / 42).toFixed(2),
    byAgent,
    dailyTrend,
  };
}

function demoUNM(): UNMHealth {
  return {
    hot: 85,
    warm: 240,
    cold: 1200,
    total: 1525,
    byCategory: {
      guidance: { hot: 12, warm: 30, cold: 150 },
      world: { hot: 8, warm: 25, cold: 180 },
      characters: { hot: 25, warm: 60, cold: 320 },
      consistency: { hot: 15, warm: 45, cold: 200 },
      summaries: { hot: 20, warm: 55, cold: 250 },
      outline: { hot: 5, warm: 25, cold: 100 },
    },
  };
}

function demoForeshadow(projectId: string): ForeshadowItem[] {
  return [
    {
      id: `${projectId}-fs-1`,
      title: "神秘信件",
      description: "第5章中主角在旧宅发现的密封信件，暗示其父亲的真实身份",
      status: "DEVELOPING",
      plantedChapter: 5,
      resolvedChapter: null,
      relatedCharacters: ["主角", "父亲"],
    },
    {
      id: `${projectId}-fs-2`,
      title: "断剑",
      description: "第12章出现的断剑残片，与传说中的上古神兵有关",
      status: "PLANTED",
      plantedChapter: 12,
      resolvedChapter: null,
      relatedCharacters: ["主角", "铸剑师"],
    },
    {
      id: `${projectId}-fs-3`,
      title: "北方边境异动",
      description: "第3章酒馆对话中提到的北方军队调动",
      status: "RESOLVED",
      plantedChapter: 3,
      resolvedChapter: 28,
      relatedCharacters: ["将军", "信使"],
    },
    {
      id: `${projectId}-fs-4`,
      title: "梦中的女子",
      description: "主角反复梦到的白衣女子，身份不明",
      status: "STALE",
      plantedChapter: 1,
      resolvedChapter: null,
      relatedCharacters: ["主角"],
    },
  ];
}

export function createStatsRoute() {
  const route = new Hono();

  /** GET / — 综合统计 */
  route.get("/", (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const stats: ProjectStats = {
      progress: demoProgress(),
      cost: demoCost(),
      unm: demoUNM(),
    };

    return c.json(stats);
  });

  /** GET /cost — 成本明细 */
  route.get("/cost", (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    return c.json(demoCost());
  });

  /** GET /foreshadow — 伏笔追踪看板 */
  route.get("/foreshadow", (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const items = demoForeshadow(projectId);
    return c.json({ items, total: items.length });
  });

  return route;
}
