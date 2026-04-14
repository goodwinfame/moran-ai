/**
 * /api/projects/:id/reviews — 审校数据 CRUD
 *
 * GET    /                — 列出项目所有审校记录（按章节分组）
 * GET    /:chapterNum     — 获取特定章节的审校详情（含所有轮次）
 * POST   /:chapterNum     — 触发手动审校
 */

import { Hono } from "hono";
import { createLogger } from "@moran/core/logger";

const log = createLogger("reviews-routes");

/**
 * 单条审校问题
 */
export interface ReviewIssue {
  id: string;
  severity: "CRITICAL" | "MAJOR" | "MINOR" | "SUGGESTION";
  category: string;
  message: string;
  evidence?: string;
  suggestion?: string;
  /** 用户裁决：accept / ignore / manual-edit / pending */
  verdict: "accept" | "ignore" | "manual-edit" | "pending";
}

/**
 * 单轮审校结果
 */
export interface ReviewRound {
  round: number;
  passed: boolean;
  score: number;
  issues: ReviewIssue[];
  timestamp: string;
}

/**
 * 章节审校记录
 */
export interface ChapterReview {
  id: string;
  projectId: string;
  chapterNumber: number;
  chapterTitle: string | null;
  /** 审校轮次记录 */
  rounds: ReviewRound[];
  /** 最终状态 */
  status: "pending" | "reviewing" | "passed" | "failed" | "force-passed";
  /** 最新审校得分 */
  latestScore: number | null;
  createdAt: string;
  updatedAt: string;
}

// 内存存储 — key: `${projectId}:${chapterNumber}`
const reviewStore = new Map<string, ChapterReview>();

function reviewKey(projectId: string, chapterNum: number) {
  return `${projectId}:${chapterNum}`;
}

/**
 * 生成 demo 审校数据 — 开发阶段使用
 */
function seedDemoReview(projectId: string, chapterNum: number): ChapterReview {
  const now = new Date().toISOString();
  const issues: ReviewIssue[] = [
    {
      id: crypto.randomUUID(),
      severity: "MAJOR",
      category: "AI痕迹",
      message: "「不禁感叹」属于AI高频用语，建议替换为更自然的表达",
      evidence: "他不禁感叹道：\"这真是太美了。\"",
      suggestion: "他长长呼出一口气——这地方，他妈的美得不像话。",
      verdict: "pending",
    },
    {
      id: crypto.randomUUID(),
      severity: "CRITICAL",
      category: "逻辑一致性",
      message: "第3章已交代张三左臂受伤，此处描写其左手持剑，存在矛盾",
      evidence: "张三左手猛地拔出长剑，寒光一闪",
      suggestion: "张三右手猛地拔出长剑，寒光一闪（左臂仍用布带吊着）",
      verdict: "pending",
    },
    {
      id: crypto.randomUUID(),
      severity: "MINOR",
      category: "文风",
      message: "连续两段使用了相同的句式结构（主语+动词+感叹），节奏略显单调",
      evidence: "他看着远方。她望着天空。",
      suggestion: "变换句式长短、加入动作或心理描写打破节奏",
      verdict: "pending",
    },
    {
      id: crypto.randomUUID(),
      severity: "SUGGESTION",
      category: "伏笔",
      message: "此处可以为第二卷的主线冲突埋下伏笔",
      suggestion: "在角色对话中暗示北方边境的异动",
      verdict: "pending",
    },
  ];

  return {
    id: crypto.randomUUID(),
    projectId,
    chapterNumber: chapterNum,
    chapterTitle: `第${chapterNum}章`,
    rounds: [
      {
        round: 1,
        passed: false,
        score: 72,
        issues,
        timestamp: now,
      },
    ],
    status: "failed",
    latestScore: 72,
    createdAt: now,
    updatedAt: now,
  };
}

export function createReviewsRoute() {
  const route = new Hono();

  /** GET / — 列出项目所有审校记录 */
  route.get("/", (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const reviews: ChapterReview[] = [];
    for (const r of reviewStore.values()) {
      if (r.projectId === projectId) {
        reviews.push(r);
      }
    }

    // 如果没有数据，生成 demo 数据（开发用）
    if (reviews.length === 0) {
      for (let i = 1; i <= 3; i++) {
        const demo = seedDemoReview(projectId, i);
        reviewStore.set(reviewKey(projectId, i), demo);
        reviews.push(demo);
      }
    }

    reviews.sort((a, b) => a.chapterNumber - b.chapterNumber);

    return c.json({ reviews, total: reviews.length });
  });

  /** GET /:chapterNum — 获取特定章节的审校详情 */
  route.get("/:chapterNum", (c) => {
    const projectId = c.req.param("id");
    const chapterNum = parseInt(c.req.param("chapterNum"), 10);

    if (!projectId || isNaN(chapterNum)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    let review = reviewStore.get(reviewKey(projectId, chapterNum));
    if (!review) {
      // 生成 demo
      review = seedDemoReview(projectId, chapterNum);
      reviewStore.set(reviewKey(projectId, chapterNum), review);
    }

    return c.json(review);
  });

  /** POST /:chapterNum — 触发手动审校 */
  route.post("/:chapterNum", async (c) => {
    const projectId = c.req.param("id");
    const chapterNum = parseInt(c.req.param("chapterNum"), 10);

    if (!projectId || isNaN(chapterNum)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    const key = reviewKey(projectId, chapterNum);
    const existing = reviewStore.get(key);
    const now = new Date().toISOString();

    if (existing) {
      // 添加新一轮审校（模拟）
      const newRound: ReviewRound = {
        round: existing.rounds.length + 1,
        passed: true,
        score: 88,
        issues: [
          {
            id: crypto.randomUUID(),
            severity: "MINOR",
            category: "文风",
            message: "部分段落过渡略显生硬，但整体通过",
            verdict: "pending",
          },
        ],
        timestamp: now,
      };
      existing.rounds.push(newRound);
      existing.status = "passed";
      existing.latestScore = 88;
      existing.updatedAt = now;
      reviewStore.set(key, existing);
      log.info({ projectId, chapterNum, round: newRound.round }, "Review triggered");
      return c.json(existing);
    } else {
      // 创建首轮审校
      const review = seedDemoReview(projectId, chapterNum);
      reviewStore.set(key, review);
      log.info({ projectId, chapterNum, round: 1 }, "Review created");
      return c.json(review, 201);
    }
  });

  /** PUT /:chapterNum/issues/:issueId/verdict — 用户裁决 */
  route.put("/:chapterNum/issues/:issueId/verdict", async (c) => {
    const projectId = c.req.param("id");
    const chapterNum = parseInt(c.req.param("chapterNum"), 10);
    const issueId = c.req.param("issueId");

    if (!projectId || isNaN(chapterNum) || !issueId) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    const body = await c.req.json<{ verdict: ReviewIssue["verdict"] }>();
    if (!body.verdict || !["accept", "ignore", "manual-edit", "pending"].includes(body.verdict)) {
      return c.json({ error: "Invalid verdict" }, 400);
    }

    const review = reviewStore.get(reviewKey(projectId, chapterNum));
    if (!review) {
      return c.json({ error: "Review not found" }, 404);
    }

    // 查找 issue 并更新
    let found = false;
    for (const round of review.rounds) {
      for (const issue of round.issues) {
        if (issue.id === issueId) {
          issue.verdict = body.verdict;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      return c.json({ error: "Issue not found" }, 404);
    }

    review.updatedAt = new Date().toISOString();
    return c.json({ updated: true, issueId, verdict: body.verdict });
  });

  /** POST /:chapterNum/force-pass — 强制通过 */
  route.post("/:chapterNum/force-pass", (c) => {
    const projectId = c.req.param("id");
    const chapterNum = parseInt(c.req.param("chapterNum"), 10);

    if (!projectId || isNaN(chapterNum)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    const key = reviewKey(projectId, chapterNum);
    let review = reviewStore.get(key);

    if (!review) {
      review = seedDemoReview(projectId, chapterNum);
    }

    review.status = "force-passed";
    review.updatedAt = new Date().toISOString();
    reviewStore.set(key, review);

    log.info({ projectId, chapterNum }, "Review force-passed");
    return c.json({ status: "force-passed" });
  });

  return route;
}
