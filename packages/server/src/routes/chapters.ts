/**
 * /api/projects/:id/chapters — 章节管理 CRUD
 *
 * GET    /                — 列出章节（摘要模式，不含正文）
 * GET    /:num            — 获取章节详情（含正文）
 * PUT    /:num            — 更新章节
 */

import { Hono } from "hono";
import { createLogger } from "@moran/core/logger";

const log = createLogger("chapters-routes");

/**
 * 章节数据 — 内存存储
 */
interface ChapterData {
  id: string;
  projectId: string;
  chapterNumber: number;
  title: string | null;
  content: string | null;
  wordCount: number;
  writerStyle: string | null;
  status: string;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

// 内存存储 — key: `${projectId}:${chapterNumber}`
const chapterStore = new Map<string, ChapterData>();

function chapterKey(projectId: string, num: number) {
  return `${projectId}:${num}`;
}

export function createChaptersRoute() {
  const route = new Hono();

  /** GET / — 列出章节（摘要模式） */
  route.get("/", (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const chapters: Omit<ChapterData, "content">[] = [];
    for (const ch of chapterStore.values()) {
      if (ch.projectId === projectId) {
        const { content: _, ...summary } = ch;
        chapters.push(summary);
      }
    }

    chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);

    return c.json({ chapters, total: chapters.length });
  });

  /** GET /:num — 获取章节详情（含正文） */
  route.get("/:num", (c) => {
    const projectId = c.req.param("id");
    const num = parseInt(c.req.param("num"), 10);

    if (!projectId || isNaN(num)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    const chapter = chapterStore.get(chapterKey(projectId, num));
    if (!chapter) {
      return c.json({ error: "Chapter not found" }, 404);
    }

    return c.json(chapter);
  });

  /** PUT /:num — 更新章节 */
  route.put("/:num", async (c) => {
    const projectId = c.req.param("id");
    const num = parseInt(c.req.param("num"), 10);

    if (!projectId || isNaN(num)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    const key = chapterKey(projectId, num);
    const existing = chapterStore.get(key);
    const body = await c.req.json<Partial<ChapterData>>();
    const now = new Date().toISOString();

    if (existing) {
      // Update
      const updated: ChapterData = {
        ...existing,
        ...body,
        id: existing.id,
        projectId,
        chapterNumber: num,
        createdAt: existing.createdAt,
        updatedAt: now,
      };
      chapterStore.set(key, updated);
      return c.json(updated);
    } else {
      // Create
      const chapter: ChapterData = {
        id: crypto.randomUUID(),
        projectId,
        chapterNumber: num,
        title: (body.title as string) ?? null,
        content: (body.content as string) ?? null,
        wordCount: (body.wordCount as number) ?? 0,
        writerStyle: (body.writerStyle as string) ?? null,
        status: (body.status as string) ?? "draft",
        currentVersion: 1,
        createdAt: now,
        updatedAt: now,
      };
      chapterStore.set(key, chapter);
      log.info({ projectId, chapterNumber: num }, "Chapter created");
      return c.json(chapter, 201);
    }
  });

  return route;
}
