/**
 * /api/projects/:id/reader-review — 书虫读者评审路由
 *
 * POST   /                 — 触发读者评审（指定章节）
 * GET    /                 — 列出项目所有读者评审记录
 * GET    /:chapterNum      — 获取特定章节的读者评审
 */

import { Hono } from "hono";
import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "@moran/core/db";
import { projectDocuments } from "@moran/core/db/schema";
import type { SessionProjectBridge, ReaderReviewInput } from "@moran/core";
import { ShuchongEngine } from "@moran/core";

// ── Types ──────────────────────────────────────────

export interface ReaderReviewRecord {
  id: string;
  projectId: string;
  chapterNumber: number;
  readabilityScore: number;
  oneLiner: string;
  boringSpots: Array<{ quote: string; reason: string }>;
  touchingMoments: Array<{ quote: string; feeling: string }>;
  favoriteCharacter: { name: string; reason: string } | null;
  freeThoughts: string;
  createdAt: string;
}

function parseReaderReviewContent(content: string | null): ReaderReviewRecord | null {
  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed as ReaderReviewRecord;
  } catch {
    return null;
  }
}

async function getLatestReaderReviewRow(projectId: string, chapterNum: number) {
  const db = getDb();
  const [row] = await db
    .select({
      id: projectDocuments.id,
      content: projectDocuments.content,
      createdAt: projectDocuments.createdAt,
    })
    .from(projectDocuments)
    .where(
      and(
        eq(projectDocuments.projectId, projectId),
        eq(projectDocuments.category, "review"),
        sql`${projectDocuments.metadata}->>'subType' = 'reader'`,
        sql`${projectDocuments.metadata}->>'chapterNumber' = ${String(chapterNum)}`,
      ),
    )
    .orderBy(desc(projectDocuments.createdAt));

  return row ?? null;
}

// ── Route factory ────────────────────────────────

export function createReaderReviewRoute(bridge: SessionProjectBridge, shuchongEngine: ShuchongEngine) {
  const route = new Hono();

  /** GET / — 列出所有读者评审 */
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
          sql`${projectDocuments.metadata}->>'subType' = 'reader'`,
        ),
      )
      .orderBy(desc(projectDocuments.createdAt));

    const reviews = rows
      .map((row) => parseReaderReviewContent(row.content))
      .filter((review): review is ReaderReviewRecord => review !== null)
      .sort((a, b) => a.chapterNumber - b.chapterNumber);

    return c.json({
      reviews: reviews.map((r) => ({
        id: r.id,
        chapterNumber: r.chapterNumber,
        readabilityScore: r.readabilityScore,
        oneLiner: r.oneLiner,
        createdAt: r.createdAt,
      })),
      total: reviews.length,
    });
  });

  /** GET /:chapterNum — 获取特定章节的读者评审 */
  route.get("/:chapterNum", async (c) => {
    const projectId = c.req.param("id");
    const chapterNum = parseInt(c.req.param("chapterNum"), 10);

    if (!projectId || Number.isNaN(chapterNum)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    const row = await getLatestReaderReviewRow(projectId, chapterNum);
    if (!row) {
      return c.json({ error: "Review not found" }, 404);
    }

    const review = parseReaderReviewContent(row.content);
    if (!review) {
      return c.json({ error: "Review data is corrupted" }, 500);
    }

    return c.json(review);
  });

  /** POST / — 触发读者评审 */
  route.post("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const body = await c.req.json<{
      chapterNumber: number;
      content?: string;
      chapterTitle?: string;
      previousSummary?: string;
      genreTags?: string[];
    }>().catch(() => null);
    if (!body || typeof body.chapterNumber !== "number") {
      return c.json({ error: "chapterNumber is required" }, 400);
    }

    let review: ReaderReviewRecord;

    if (body.content) {
      try {
        await bridge.ensureSession(projectId);
        const reviewInput: ReaderReviewInput = {
          content: body.content,
          chapterNumber: body.chapterNumber,
          chapterTitle: body.chapterTitle,
          previousSummary: body.previousSummary,
          genreTags: body.genreTags,
        };
        const engineResult = await shuchongEngine.review(reviewInput, bridge);

        review = {
          id: crypto.randomUUID(),
          projectId,
          chapterNumber: body.chapterNumber,
          readabilityScore: engineResult.readabilityScore,
          oneLiner: engineResult.oneLiner,
          boringSpots: engineResult.boringSpots,
          touchingMoments: engineResult.touchingMoments,
          favoriteCharacter: engineResult.favoriteCharacter,
          freeThoughts: engineResult.freeThoughts,
          createdAt: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Failed to generate reader review", error);
        return c.json({ error: "Failed to generate reader review" }, 500);
      }
    } else {
      review = {
        id: crypto.randomUUID(),
        projectId,
        chapterNumber: body.chapterNumber,
        readabilityScore: 0,
        oneLiner: "pending",
        boringSpots: [],
        touchingMoments: [],
        favoriteCharacter: null,
        freeThoughts: "pending",
        createdAt: new Date().toISOString(),
      };
    }

    const db = getDb();
    const [created] = await db
      .insert(projectDocuments)
      .values({
        projectId,
        category: "review",
        title: `reader-review:ch${body.chapterNumber}`,
        content: JSON.stringify(review),
        metadata: {
          chapterNumber: body.chapterNumber,
          subType: "reader",
        },
      })
      .returning({ id: projectDocuments.id });

    if (!created) {
      return c.json({ error: "Failed to create review" }, 500);
    }

    return c.json(review, 201);
  });

  return route;
}
