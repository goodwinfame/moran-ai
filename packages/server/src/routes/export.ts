/**
 * /api/projects/:id/export — 导出小说
 *
 * GET  /formats            — 获取支持的导出格式列表
 * GET  /:format            — 下载导出文件 (epub / txt / markdown)
 *   Query params:
 *     start — 起始章节号（含）
 *     end   — 结束章节号（含）
 */

import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "@moran/core/db";
import { chapters, projects } from "@moran/core/db/schema";
import { createLogger } from "@moran/core/logger";
import {
  exportNovel,
  SUPPORTED_FORMATS,
  type ExportFormat,
  type ExportChapter,
} from "../export/index.js";

const log = createLogger("export-routes");

export function createExportRoute() {
  const route = new Hono();

  /** GET /formats — 支持的导出格式列表 */
  route.get("/formats", (c) => {
    return c.json({
      formats: SUPPORTED_FORMATS.map((f) => ({
        id: f,
        label:
          f === "epub"
            ? "EPUB 电子书"
            : f === "txt"
              ? "TXT 纯文本"
              : "Markdown",
        mimeType:
          f === "epub"
            ? "application/epub+zip"
            : f === "txt"
              ? "text/plain"
              : "text/markdown",
        extension: f === "epub" ? ".epub" : f === "txt" ? ".txt" : ".md",
      })),
    });
  });

  /** GET /:format — 下载导出文件 */
  route.get("/:format", async (c) => {
    const projectId = c.req.param("id");
    const format = c.req.param("format") as string;
    const db = getDb();

    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    if (!SUPPORTED_FORMATS.includes(format as ExportFormat)) {
      return c.json(
        {
          error: `Unsupported format: ${format}. Supported: ${SUPPORTED_FORMATS.join(", ")}`,
        },
        400,
      );
    }

    const [project] = await db
      .select({
        title: projects.title,
        description: projects.toneDescription,
        language: projects.language,
        author: projects.userId,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const chapterRows = await db
      .select({
        chapterNumber: chapters.chapterNumber,
        title: chapters.title,
        content: chapters.content,
        wordCount: chapters.wordCount,
      })
      .from(chapters)
      .where(eq(chapters.projectId, projectId))
      .orderBy(asc(chapters.chapterNumber));

    if (chapterRows.length === 0) {
      return c.json({ error: "No chapters available for export" }, 404);
    }

    const startParam = c.req.query("start");
    const endParam = c.req.query("end");
    const startChapter = startParam ? parseInt(startParam, 10) : undefined;
    const endChapter = endParam ? parseInt(endParam, 10) : undefined;

    if (startParam && Number.isNaN(startChapter as number)) {
      return c.json({ error: "Invalid start parameter" }, 400);
    }
    if (endParam && Number.isNaN(endChapter as number)) {
      return c.json({ error: "Invalid end parameter" }, 400);
    }

    const exportableChapters: ExportChapter[] = chapterRows.map((chapter) => ({
      chapterNumber: chapter.chapterNumber,
      title: chapter.title ?? `第${chapter.chapterNumber}章`,
      content: chapter.content ?? "",
      wordCount: chapter.wordCount ?? 0,
    }));

    try {
      const result = await exportNovel({
        title: project.title,
        author: project.author ?? "墨染用户",
        lang: project.language ?? "zh",
        description: project.description ?? "",
        chapters: exportableChapters,
        startChapter,
        endChapter,
        format: format as ExportFormat,
      });

      log.info(
        { projectId, format, chapters: exportableChapters.length },
        "Export generated",
      );

      const encodedFilename = encodeURIComponent(result.filename);
      c.header("Content-Type", result.mimeType);
      c.header(
        "Content-Disposition",
        `attachment; filename="export.${format === "markdown" ? "md" : format}"; filename*=UTF-8''${encodedFilename}`,
      );

      if (typeof result.data === "string") {
        return c.body(result.data);
      }

      const uint8 = new Uint8Array(result.data);
      return c.body(uint8);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ projectId, format, error: message }, "Export failed");
      return c.json({ error: `Export failed: ${message}` }, 500);
    }
  });

  return route;
}
