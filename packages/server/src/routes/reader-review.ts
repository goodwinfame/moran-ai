/**
 * /api/projects/:id/reader-review — 书虫读者评审路由
 *
 * POST   /                 — 触发读者评审（指定章节）
 * GET    /                 — 列出项目所有读者评审记录
 * GET    /:chapterNum      — 获取特定章节的读者评审
 */

import { Hono } from "hono";

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

// ── In-memory store ────────────────────────────────

const readerReviewStore = new Map<string, ReaderReviewRecord>();

function reviewKey(projectId: string, chapterNum: number) {
  return `${projectId}:${chapterNum}`;
}

// ── Demo data ────────────────────────────────────

function seedDemoReaderReview(projectId: string, chapterNum: number): ReaderReviewRecord {
  return {
    id: crypto.randomUUID(),
    projectId,
    chapterNumber: chapterNum,
    readabilityScore: 7,
    oneLiner: "\u5F00\u5934\u8FD8\u884C\uFF0C\u4E2D\u95F4\u6709\u70B9\u62D6\uFF0C\u7ED3\u5C3E\u7684\u60AC\u5FF5\u4E0D\u9519",
    boringSpots: [
      {
        quote: "\u4ED6\u8D70\u5728\u8DEF\u4E0A\uFF0C\u770B\u7740\u8FDC\u65B9\u7684\u5929\u9645\u7EBF\uFF0C\u5FC3\u4E2D\u6D6E\u73B0\u51FA\u5F88\u591A\u60F3\u6CD5\u3002",
        reason: "\u8FD9\u6BB5\u592A\u6C34\u4E86\uFF0C\u201C\u5F88\u591A\u60F3\u6CD5\u201D\u5230\u5E95\u662F\u4EC0\u4E48\u60F3\u6CD5\u5440\uFF1F\u770B\u5F97\u6211\u90FD\u60F3\u5237\u624B\u673A\u4E86",
      },
    ],
    touchingMoments: [
      {
        quote: "\u5E08\u59B9\u6CA1\u8BF4\u8BDD\uFF0C\u53EA\u662F\u628A\u81EA\u5DF1\u7684\u5916\u8863\u62AB\u5728\u4E86\u4ED6\u80A9\u4E0A\u3002",
        feeling: "\u8FD9\u4E2A\u7EC6\u8282\u597D\u6696\uFF0C\u6CA1\u6709\u591A\u4F59\u7684\u5BF9\u767D\uFF0C\u5C31\u662F\u4E00\u4E2A\u52A8\u4F5C\uFF0C\u4F46\u5F88\u6253\u52A8\u4EBA",
      },
    ],
    favoriteCharacter: {
      name: "\u5E08\u59B9",
      reason: "\u6CA1\u600E\u4E48\u51FA\u573A\u4F46\u6BCF\u6B21\u51FA\u573A\u90FD\u5F88\u6709\u5B58\u5728\u611F\uFF0C\u8BF4\u8BDD\u6BD2\u820C\u4F46\u5FC3\u91CC\u5F88\u5728\u4E4E\u4EBA",
    },
    freeThoughts: "\u6574\u4F53\u8FD8\u884C\uFF0C\u4F46\u4E2D\u95F4\u90A3\u6BB5\u63CF\u5199\u4FEE\u70BC\u7684\u90E8\u5206\u771F\u7684\u6709\u70B9\u65E0\u804A\uFF0C\u611F\u89C9\u50CF\u51D1\u5B57\u6570\u3002\u7ED3\u5C3E\u7684\u60AC\u5FF5\u4E0D\u9519\uFF0C\u6211\u60F3\u770B\u4E0B\u4E00\u7AE0\u3002\u5E0C\u671B\u540E\u9762\u80FD\u6253\u8D77\u6765\uFF01",
    createdAt: new Date().toISOString(),
  };
}

// ── Route factory ────────────────────────────────

export function createReaderReviewRoute() {
  const route = new Hono();

  /** GET / — \u5217\u51FA\u6240\u6709\u8BFB\u8005\u8BC4\u5BA1 */
  route.get("/", (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const reviews: ReaderReviewRecord[] = [];
    for (const r of readerReviewStore.values()) {
      if (r.projectId === projectId) {
        reviews.push(r);
      }
    }

    // Seed demo data if empty
    if (reviews.length === 0) {
      for (let i = 1; i <= 3; i++) {
        const demo = seedDemoReaderReview(projectId, i);
        readerReviewStore.set(reviewKey(projectId, i), demo);
        reviews.push(demo);
      }
    }

    reviews.sort((a, b) => a.chapterNumber - b.chapterNumber);

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

  /** GET /:chapterNum — \u83B7\u53D6\u7279\u5B9A\u7AE0\u8282\u7684\u8BFB\u8005\u8BC4\u5BA1 */
  route.get("/:chapterNum", (c) => {
    const projectId = c.req.param("id");
    const chapterNum = parseInt(c.req.param("chapterNum"), 10);

    if (!projectId || isNaN(chapterNum)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    let review = readerReviewStore.get(reviewKey(projectId, chapterNum));
    if (!review) {
      review = seedDemoReaderReview(projectId, chapterNum);
      readerReviewStore.set(reviewKey(projectId, chapterNum), review);
    }

    return c.json(review);
  });

  /** POST / — \u89E6\u53D1\u8BFB\u8005\u8BC4\u5BA1 */
  route.post("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const body = await c.req.json<{ chapterNumber: number }>().catch(() => null);
    if (!body || typeof body.chapterNumber !== "number") {
      return c.json({ error: "chapterNumber is required" }, 400);
    }

    // In dev mode, generate demo review
    const review = seedDemoReaderReview(projectId, body.chapterNumber);
    readerReviewStore.set(reviewKey(projectId, body.chapterNumber), review);

    return c.json(review, 201);
  });

  return route;
}
