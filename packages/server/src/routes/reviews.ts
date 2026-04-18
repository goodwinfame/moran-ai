/**
 * /api/projects/:id/reviews — 审校数据 CRUD
 *
 * GET    /                — 列出项目所有审校记录（按章节分组）
 * GET    /:chapterNum     — 获取特定章节的审校详情（含所有轮次）
 * POST   /:chapterNum     — 触发手动审校
 */

import { Hono } from "hono";
import { eq, and, desc, sql } from "drizzle-orm";
import { ReviewEngine } from "@moran/core";
import type { FullReviewResult, ReviewInput, SessionProjectBridge, ReviewIssue as CoreReviewIssue } from "@moran/core";
import { getDb } from "@moran/core/db";
import { projectDocuments } from "@moran/core/db/schema";
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

function mapSeverity(severity: CoreReviewIssue["severity"]): ReviewIssue["severity"] {
  switch (severity) {
    case "critical":
      return "CRITICAL";
    case "major":
      return "MAJOR";
    case "minor":
      return "MINOR";
    case "suggestion":
      return "SUGGESTION";
  }
}

function mapEngineIssue(issue: CoreReviewIssue): ReviewIssue {
  return {
    id: crypto.randomUUID(),
    severity: mapSeverity(issue.severity),
    category: "general",
    message: issue.issue,
    evidence: issue.evidence,
    suggestion: issue.suggestion,
    verdict: "pending",
  };
}

function buildReviewFromEngine(projectId: string, chapterNum: number, result: FullReviewResult): ChapterReview {
  const now = new Date().toISOString();
  const roundIssues = result.allIssues.map(mapEngineIssue);

  return {
    id: crypto.randomUUID(),
    projectId,
    chapterNumber: chapterNum,
    chapterTitle: `第${chapterNum}章`,
    rounds: [
      {
        round: 1,
        passed: result.passed,
        score: result.score,
        issues: roundIssues,
        timestamp: now,
      },
    ],
    status: result.passed ? "passed" : "failed",
    latestScore: result.score,
    createdAt: now,
    updatedAt: now,
  };
}

function buildPendingReview(projectId: string, chapterNum: number, existing?: ChapterReview): ChapterReview {
  const now = new Date().toISOString();
  const pendingRound: ReviewRound = {
    round: existing ? existing.rounds.length + 1 : 1,
    passed: false,
    score: 0,
    issues: [],
    timestamp: now,
  };

  if (existing) {
    return {
      ...existing,
      rounds: [...existing.rounds, pendingRound],
      status: "reviewing",
      updatedAt: now,
    };
  }

  return {
    id: crypto.randomUUID(),
    projectId,
    chapterNumber: chapterNum,
    chapterTitle: `第${chapterNum}章`,
    rounds: [pendingRound],
    status: "reviewing",
    latestScore: null,
    createdAt: now,
    updatedAt: now,
  };
}

function toMetadata(review: ChapterReview) {
  return {
    chapterNumber: review.chapterNumber,
    status: review.status,
    latestScore: review.latestScore,
    subType: "jaggers",
  };
}

function parseReviewContent(content: string): ChapterReview | null {
  try {
    return JSON.parse(content) as ChapterReview;
  } catch {
    return null;
  }
}

async function getLatestReviewRow(projectId: string, chapterNum: number) {
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
        eq(projectDocuments.category, "review"),
        sql`${projectDocuments.metadata}->>'subType' = 'jaggers'`,
        sql`${projectDocuments.metadata}->>'chapterNumber' = ${String(chapterNum)}`,
      ),
    )
    .orderBy(desc(projectDocuments.createdAt));

  return row ?? null;
}

async function upsertReviewDocument(projectId: string, review: ChapterReview, existingId?: string) {
  const db = getDb();
  const values = {
    projectId,
    category: "review" as const,
    title: `review:ch${review.chapterNumber}`,
    content: JSON.stringify(review),
    metadata: toMetadata(review),
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

export function createReviewsRoute(bridge: SessionProjectBridge, reviewEngine: ReviewEngine) {
  const route = new Hono();

  /** GET / — 列出项目所有审校记录 */
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
          eq(projectDocuments.category, "review"),
          sql`${projectDocuments.metadata}->>'subType' = 'jaggers'`,
        ),
      )
      .orderBy(desc(projectDocuments.createdAt));

    const reviews = rows
      .map((row) => parseReviewContent(row.content))
      .filter((review): review is ChapterReview => review !== null)
      .sort((a, b) => a.chapterNumber - b.chapterNumber);

    return c.json({ reviews, total: reviews.length });
  });

  /** GET /:chapterNum — 获取特定章节的审校详情 */
  route.get("/:chapterNum", async (c) => {
    const projectId = c.req.param("id");
    const chapterNum = parseInt(c.req.param("chapterNum"), 10);

    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    if (Number.isNaN(chapterNum)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    const row = await getLatestReviewRow(projectId, chapterNum);
    if (!row) {
      return c.json({ error: "Review not found" }, 404);
    }

    const review = parseReviewContent(row.content);
    if (!review) {
      return c.json({ error: "Review data is corrupted" }, 500);
    }

    return c.json(review);
  });

  /** POST /:chapterNum — 触发手动审校 */
  route.post("/:chapterNum", async (c) => {
    const projectId = c.req.param("id");
    const chapterNum = parseInt(c.req.param("chapterNum"), 10);

    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    if (Number.isNaN(chapterNum)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    const body = await c.req.json<{ content?: string }>();
    const row = await getLatestReviewRow(projectId, chapterNum);
    const now = new Date().toISOString();

    if (row) {
      const existing = parseReviewContent(row.content);
      if (!existing) {
        return c.json({ error: "Review data is corrupted" }, 500);
      }

      const updated = body.content
        ? (async () => {
            const content = body.content as string; // narrowed by ternary guard above
            await bridge.ensureSession(projectId);
            const reviewInput: ReviewInput = { content, chapterNumber: chapterNum, arcNumber: 1 };
            const engineResult = await reviewEngine.review(reviewInput, bridge);
            const newRound: ReviewRound = {
              round: existing.rounds.length + 1,
              passed: engineResult.passed,
              score: engineResult.score,
              issues: engineResult.allIssues.map(mapEngineIssue),
              timestamp: now,
            };

            return {
              ...existing,
              rounds: [...existing.rounds, newRound],
              status: engineResult.passed ? "passed" : "failed",
              latestScore: engineResult.score,
              updatedAt: now,
            } as ChapterReview;
          })()
        : Promise.resolve(buildPendingReview(projectId, chapterNum, existing));

      const nextReview = await updated;

      const savedId = await upsertReviewDocument(projectId, nextReview, row.id);
      if (!savedId) {
        return c.json({ error: "Failed to update review" }, 500);
      }

      log.info({ projectId, chapterNum, round: nextReview.rounds.length }, "Review triggered");
      return c.json(nextReview);
    }

    if (body.content) {
      await bridge.ensureSession(projectId);
      const reviewInput: ReviewInput = { content: body.content, chapterNumber: chapterNum, arcNumber: 1 };
      const engineResult = await reviewEngine.review(reviewInput, bridge);
      const review = buildReviewFromEngine(projectId, chapterNum, engineResult);
      const savedId = await upsertReviewDocument(projectId, review);
      if (!savedId) {
        return c.json({ error: "Failed to create review" }, 500);
      }

      log.info({ projectId, chapterNum, round: 1 }, "Review created");
      return c.json(review, 201);
    }

    const review = buildPendingReview(projectId, chapterNum);
    const savedId = await upsertReviewDocument(projectId, review);
    if (!savedId) {
      return c.json({ error: "Failed to create review" }, 500);
    }

    log.info({ projectId, chapterNum, round: 1 }, "Review created");
    return c.json(review, 201);
  });

  /** PUT /:chapterNum/issues/:issueId/verdict — 用户裁决 */
  route.put("/:chapterNum/issues/:issueId/verdict", async (c) => {
    const projectId = c.req.param("id");
    const chapterNum = parseInt(c.req.param("chapterNum"), 10);
    const issueId = c.req.param("issueId");

    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    if (Number.isNaN(chapterNum) || !issueId) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    const body = await c.req.json<{ verdict: ReviewIssue["verdict"] }>();
    if (!body.verdict || !["accept", "ignore", "manual-edit", "pending"].includes(body.verdict)) {
      return c.json({ error: "Invalid verdict" }, 400);
    }

    const row = await getLatestReviewRow(projectId, chapterNum);
    if (!row) {
      return c.json({ error: "Review not found" }, 404);
    }

    const review = parseReviewContent(row.content);
    if (!review) {
      return c.json({ error: "Review data is corrupted" }, 500);
    }

    let found = false;
    for (const round of review.rounds) {
      for (const issue of round.issues) {
        if (issue.id === issueId) {
          issue.verdict = body.verdict;
          found = true;
          break;
        }
      }
      if (found) {
        break;
      }
    }

    if (!found) {
      return c.json({ error: "Issue not found" }, 404);
    }

    review.updatedAt = new Date().toISOString();
    const savedId = await upsertReviewDocument(projectId, review, row.id);
    if (!savedId) {
      return c.json({ error: "Failed to update review" }, 500);
    }

    return c.json({ updated: true, issueId, verdict: body.verdict });
  });

  /** POST /:chapterNum/force-pass — 强制通过 */
  route.post("/:chapterNum/force-pass", async (c) => {
    const projectId = c.req.param("id");
    const chapterNum = parseInt(c.req.param("chapterNum"), 10);

    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    if (Number.isNaN(chapterNum)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    const row = await getLatestReviewRow(projectId, chapterNum);
    const now = new Date().toISOString();
    const review = row
      ? (() => {
          const existing = parseReviewContent(row.content);
          if (!existing) {
            return null;
          }

          return {
            ...existing,
            status: "force-passed" as const,
            updatedAt: now,
          };
        })()
      : {
          id: crypto.randomUUID(),
          projectId,
          chapterNumber: chapterNum,
          chapterTitle: `第${chapterNum}章`,
          rounds: [],
          status: "force-passed" as const,
          latestScore: null,
          createdAt: now,
          updatedAt: now,
        };

    if (!review) {
      return c.json({ error: "Review data is corrupted" }, 500);
    }

    const savedId = await upsertReviewDocument(projectId, review, row?.id);
    if (!savedId) {
      return c.json({ error: "Failed to update review" }, 500);
    }

    log.info({ projectId, chapterNum }, "Review force-passed");
    return c.json({ status: "force-passed" });
  });

  return route;
}
