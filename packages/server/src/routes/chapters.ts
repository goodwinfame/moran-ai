/**
 * /api/projects/:id/chapters — 章节管理 CRUD
 *
 * GET    /                — 列出章节（摘要模式，不含正文）
 * GET    /:num            — 获取章节详情（含正文）
 * PUT    /:num            — 更新章节
 */

import { Hono } from "hono";
import { eq, and, asc } from "drizzle-orm";
import { getDb } from "@moran/core/db";
import { chapters } from "@moran/core/db/schema";
import { createLogger } from "@moran/core/logger";

const log = createLogger("chapters-routes");

type ChapterStatus = "draft" | "reviewing" | "archived" | "dirty";

function isValidChapterStatus(s: string): s is ChapterStatus {
  return s === "draft" || s === "reviewing" || s === "archived" || s === "dirty";
}

export function createChaptersRoute() {
  const route = new Hono();

  /** GET / — 列出章节（摘要模式） */
  route.get("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const db = getDb();
    const rows = await db
      .select({
        id: chapters.id,
        projectId: chapters.projectId,
        chapterNumber: chapters.chapterNumber,
        title: chapters.title,
        wordCount: chapters.wordCount,
        writerStyle: chapters.writerStyle,
        status: chapters.status,
        currentVersion: chapters.currentVersion,
        createdAt: chapters.createdAt,
        updatedAt: chapters.updatedAt,
      })
      .from(chapters)
      .where(eq(chapters.projectId, projectId))
      .orderBy(asc(chapters.chapterNumber));

    return c.json({ chapters: rows, total: rows.length });
  });

  /** GET /:num — 获取章节详情（含正文） */
  route.get("/:num", async (c) => {
    const projectId = c.req.param("id");
    const num = parseInt(c.req.param("num"), 10);

    if (!projectId || isNaN(num)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    const db = getDb();
    const [chapter] = await db
      .select({
        id: chapters.id,
        projectId: chapters.projectId,
        chapterNumber: chapters.chapterNumber,
        title: chapters.title,
        content: chapters.content,
        wordCount: chapters.wordCount,
        writerStyle: chapters.writerStyle,
        status: chapters.status,
        currentVersion: chapters.currentVersion,
        createdAt: chapters.createdAt,
        updatedAt: chapters.updatedAt,
      })
      .from(chapters)
      .where(and(eq(chapters.projectId, projectId), eq(chapters.chapterNumber, num)));

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

    const db = getDb();
    const [existing] = await db
      .select({
        id: chapters.id,
        projectId: chapters.projectId,
        chapterNumber: chapters.chapterNumber,
        title: chapters.title,
        content: chapters.content,
        wordCount: chapters.wordCount,
        writerStyle: chapters.writerStyle,
        status: chapters.status,
        currentVersion: chapters.currentVersion,
        createdAt: chapters.createdAt,
        updatedAt: chapters.updatedAt,
      })
      .from(chapters)
      .where(and(eq(chapters.projectId, projectId), eq(chapters.chapterNumber, num)));

    const body = await c.req.json<{
      title?: string | null;
      content?: string | null;
      wordCount?: number;
      writerStyle?: string | null;
      status?: string;
      currentVersion?: number;
    }>();

    if (existing) {
      const [updated] = await db
        .update(chapters)
        .set({
          title: body.title !== undefined ? body.title : existing.title,
          content: body.content !== undefined ? body.content : existing.content,
          wordCount: body.wordCount !== undefined ? body.wordCount : existing.wordCount,
          writerStyle: body.writerStyle !== undefined ? body.writerStyle : existing.writerStyle,
          status: body.status !== undefined
            ? (isValidChapterStatus(body.status) ? body.status : existing.status)
            : existing.status,
          currentVersion:
            body.currentVersion !== undefined ? body.currentVersion : existing.currentVersion,
          updatedAt: new Date(),
        })
        .where(and(eq(chapters.projectId, projectId), eq(chapters.chapterNumber, num)))
        .returning({
          id: chapters.id,
          projectId: chapters.projectId,
          chapterNumber: chapters.chapterNumber,
          title: chapters.title,
          content: chapters.content,
          wordCount: chapters.wordCount,
          writerStyle: chapters.writerStyle,
          status: chapters.status,
          currentVersion: chapters.currentVersion,
          createdAt: chapters.createdAt,
          updatedAt: chapters.updatedAt,
        });

      if (!updated) return c.json({ error: "Failed to update chapter" }, 500);
      return c.json(updated);
    }

    const [created] = await db
      .insert(chapters)
      .values({
        projectId,
        chapterNumber: num,
        title: body.title ?? null,
        content: body.content ?? null,
        wordCount: body.wordCount ?? 0,
        writerStyle: body.writerStyle ?? null,
        status: (body.status && isValidChapterStatus(body.status)) ? body.status : "draft",
        currentVersion: body.currentVersion ?? 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({
        id: chapters.id,
        projectId: chapters.projectId,
        chapterNumber: chapters.chapterNumber,
        title: chapters.title,
        content: chapters.content,
        wordCount: chapters.wordCount,
        writerStyle: chapters.writerStyle,
        status: chapters.status,
        currentVersion: chapters.currentVersion,
        createdAt: chapters.createdAt,
        updatedAt: chapters.updatedAt,
      });

    log.info({ projectId, chapterNumber: num }, "Chapter created");
    if (!created) return c.json({ error: "Failed to create chapter" }, 500);
    return c.json(created, 201);
  });

  return route;
}
