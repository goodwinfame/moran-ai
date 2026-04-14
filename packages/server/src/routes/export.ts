/**
 * /api/projects/:id/export — 导出小说
 *
 * GET  /formats            — 获取支持的导出格式列表
 * GET  /:format            — 下载导出文件 (epub / txt / markdown)
 *   Query params:
 *     start — 起始章节号（含）
 *     end   — 结束章节号（含）
 */

import { Hono } from "hono";
import { createLogger } from "@moran/core/logger";
import {
  exportNovel,
  SUPPORTED_FORMATS,
  type ExportFormat,
  type ExportChapter,
} from "../export/index.js";

const log = createLogger("export-routes");

// ── 章节数据内存存储（与 chapters route 共享的 demo 数据模式） ──

interface ChapterRecord {
  chapterNumber: number;
  title: string | null;
  content: string;
  wordCount: number;
  status: string;
}

const demoStore = new Map<string, ChapterRecord[]>();

function seedDemoChapters(projectId: string): ChapterRecord[] {
  const existing = demoStore.get(projectId);
  if (existing) {
    return existing;
  }

  const chapters: ChapterRecord[] = [
    {
      chapterNumber: 1,
      title: "\u521D\u5165\u4FEE\u4ED9\u754C",
      content:
        "\u6668\u66E6\u65F6\u5206\uFF0C\u4E00\u7F15\u6DE1\u91D1\u8272\u7684\u5149\u8292\u7A7F\u900F\u8584\u96FE\uFF0C\u7167\u5728\u4E91\u96FE\u7F2D\u7ED5\u7684\u5C71\u5CF0\u4E4B\u4E0A\u3002\n\n\u5C11\u5E74\u7AD9\u5728\u5C71\u5D0E\u8FB9\u7F18\uFF0C\u6DF1\u5438\u4E86\u4E00\u53E3\u5E26\u7740\u6F6E\u6E7F\u6C14\u606F\u7684\u5C71\u98CE\uFF0C\u7F13\u7F13\u5F20\u5F00\u4E86\u53CC\u77E3\u3002\n\n\u201C\u8FD9\u91CC\u5C31\u662F\u9752\u4E91\u5B97\u4E86\u5417\uFF1F\u201D\u4ED6\u8F7B\u58F0\u81EA\u8BED\uFF0C\u76EE\u5149\u4E2D\u6620\u5C04\u51FA\u671F\u5F85\u4E0E\u5FD0\u5FD1\u3002\n\n\u4ED6\u53EB\u6797\u6E0A\uFF0C\u5341\u4E94\u5C81\uFF0C\u6765\u81EA\u5C71\u4E0B\u4E00\u4E2A\u4E0D\u8D77\u773C\u7684\u5C0F\u9547\u3002\u7236\u4EB2\u662F\u4E2A\u94C1\u5320\uFF0C\u6BCD\u4EB2\u5728\u4ED6\u5341\u5C81\u90A3\u5E74\u79BB\u4E16\uFF0C\u7559\u4E0B\u4E00\u5757\u6E29\u6DA6\u7684\u7389\u4F69\u548C\u4E00\u53E5\u8BDD\uFF1A\u201C\u5230\u9752\u4E91\u5B97\u53BB\uFF0C\u627E\u4E00\u4E2A\u53EB\u82CF\u5143\u7684\u4EBA\u3002\u201D\n\n\u4ED6\u7B49\u4E86\u4E94\u5E74\uFF0C\u7B49\u7236\u4EB2\u5E74\u8FC8\u65F6\u6446\u6446\u624B\u8BA9\u4ED6\u8D70\uFF0C\u7B49\u81EA\u5DF1\u591F\u5F3A\u58EE\u80FD\u5FCD\u53D7\u5C71\u8DEF\u7684\u98A0\u7C38\u3002\u4ECA\u5929\uFF0C\u4ED6\u7EC8\u4E8E\u7AD9\u5728\u4E86\u8FD9\u91CC\u3002",
      wordCount: 230,
      status: "archived",
    },
    {
      chapterNumber: 2,
      title: "\u62DC\u5E08\u4E4B\u8DEF",
      content:
        "\u9752\u4E91\u5B97\u7684\u5916\u95E8\u5F1F\u5B50\u8BD5\u7EC3\u573A\u4E0A\uFF0C\u7A7A\u6C14\u4E2D\u5F25\u6F2B\u7740\u6C57\u6C34\u548C\u8349\u836F\u7684\u5473\u9053\u3002\n\n\u6797\u6E0A\u6B63\u7167\u7740\u5E08\u5144\u6559\u7684\u65B9\u6CD5\u7EC3\u4E60\u5410\u7EB3\u672F\uFF0C\u5374\u603B\u89C9\u5F97\u4F53\u5185\u7684\u7075\u529B\u50CF\u6CDB\u6EE5\u7684\u6CB3\u6C34\u2014\u2014\u660E\u660E\u5F88\u591A\uFF0C\u5374\u603B\u4E5F\u6C47\u4E0D\u6210\u4E00\u80A1\u5B8C\u6574\u7684\u6D41\u3002\n\n\u201C\u4F60\u7684\u7075\u6839\u5F88\u7279\u6B8A\u3002\u201D\u4E00\u4E2A\u82CD\u8001\u7684\u58F0\u97F3\u4ECE\u8EAB\u540E\u4F20\u6765\u3002\n\n\u6797\u6E0A\u8F6C\u8EAB\uFF0C\u770B\u89C1\u4E00\u4E2A\u767D\u53D1\u82CD\u82CD\u7684\u8001\u8005\u7AD9\u5728\u8EAB\u540E\uFF0C\u624B\u4E2D\u62C4\u7740\u4E00\u6839\u77ED\u7B1B\uFF0C\u795E\u60C5\u6DE1\u7136\u3002",
      wordCount: 180,
      status: "archived",
    },
    {
      chapterNumber: 3,
      title: "\u7075\u6839\u4E4B\u8C1C",
      content:
        "\u82CF\u5143\u5E26\u7740\u6797\u6E0A\u6765\u5230\u540E\u5C71\u4E00\u5904\u5E7D\u9759\u7684\u5C71\u6D1E\u3002\u6D1E\u5185\u77F3\u58C1\u4E0A\u523B\u6EE1\u4E86\u5BC6\u5BC6\u9EBB\u9EBB\u7684\u7B26\u6587\uFF0C\u9690\u7EA6\u6563\u53D1\u7740\u6DE1\u6DE1\u7684\u5149\u8292\u3002\n\n\u201C\u4F38\u51FA\u624B\u3002\u201D\u82CF\u5143\u7684\u58F0\u97F3\u5F88\u8F7B\uFF0C\u5374\u5E26\u7740\u4E0D\u5BB9\u62D2\u7EDD\u7684\u5A01\u4E25\u3002\n\n\u6797\u6E0A\u4F9D\u8A00\u4F38\u51FA\u53F3\u624B\u3002\u82CF\u5143\u8F7B\u8F7B\u6309\u5728\u4ED6\u7684\u8109\u95E8\u4E0A\uFF0C\u95ED\u76EE\u611F\u53D7\u4E86\u7247\u523B\uFF0C\u772F\u5F00\u773C\u7684\u795E\u60C5\u6709\u4E9B\u590D\u6742\u3002\n\n\u201C\u5E08\u7236\uFF0C\u600E\u4E48\u4E86\uFF1F\u201D\n\n\u201C\u4F60\u7684\u7075\u6839\u662F\u6DF7\u6C8C\u4E4B\u4F53\u3002\u201D\u82CF\u5143\u8F7B\u8F7B\u53F9\u4E86\u53E3\u6C14\uFF0C\u201C\u4E16\u4E0A\u6781\u7F55\u89C1\u7684\u7075\u6839\u2014\u2014\u7ED9\u4F60\u65E2\u662F\u798F\uFF0C\u4E5F\u662F\u7978\u3002\u201D",
      wordCount: 200,
      status: "archived",
    },
  ];

  demoStore.set(projectId, chapters);
  return chapters;
}

/**
 * 项目元数据 — 简化版（导出用）
 */
interface ProjectMeta {
  title: string;
  author: string;
  lang: string;
  description: string;
}

function getDemoProject(_projectId: string): ProjectMeta {
  return {
    title: "\u4ED9\u9014",
    author: "\u58A8\u67D3\u7528\u6237",
    lang: "zh",
    description: "\u4E00\u4E2A\u5C11\u5E74\u7684\u4FEE\u4ED9\u4E4B\u8DEF",
  };
}

export function createExportRoute() {
  const route = new Hono();

  /** GET /formats — 支持的导出格式列表 */
  route.get("/formats", (c) => {
    return c.json({
      formats: SUPPORTED_FORMATS.map((f) => ({
        id: f,
        label:
          f === "epub"
            ? "EPUB \u7535\u5B50\u4E66"
            : f === "txt"
              ? "TXT \u7EAF\u6587\u672C"
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

    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    // 验证格式
    if (!SUPPORTED_FORMATS.includes(format as ExportFormat)) {
      return c.json(
        {
          error: `Unsupported format: ${format}. Supported: ${SUPPORTED_FORMATS.join(", ")}`,
        },
        400,
      );
    }

    // 获取项目元数据
    const project = getDemoProject(projectId);

    // 获取章节数据
    const allChapters = seedDemoChapters(projectId);

    // 解析范围参数
    const startParam = c.req.query("start");
    const endParam = c.req.query("end");
    const startChapter = startParam ? parseInt(startParam, 10) : undefined;
    const endChapter = endParam ? parseInt(endParam, 10) : undefined;

    if (startParam && isNaN(startChapter as number)) {
      return c.json({ error: "Invalid start parameter" }, 400);
    }
    if (endParam && isNaN(endChapter as number)) {
      return c.json({ error: "Invalid end parameter" }, 400);
    }

    // 过滤为已归档的章节
    const exportableChapters: ExportChapter[] = allChapters
      .filter((ch) => ch.status === "archived" || ch.status === "draft")
      .map((ch) => ({
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        content: ch.content,
        wordCount: ch.wordCount,
      }));

    if (exportableChapters.length === 0) {
      return c.json({ error: "No chapters available for export" }, 404);
    }

    try {
      const result = await exportNovel({
        title: project.title,
        author: project.author,
        lang: project.lang,
        description: project.description,
        chapters: exportableChapters,
        startChapter,
        endChapter,
        format: format as ExportFormat,
      });

      log.info(
        { projectId, format, chapters: exportableChapters.length },
        "Export generated",
      );

      // RFC 5987 编码处理中文文件名
      const encodedFilename = encodeURIComponent(result.filename);
      c.header("Content-Type", result.mimeType);
      c.header(
        "Content-Disposition",
        `attachment; filename="export.${format === "markdown" ? "md" : format}"; filename*=UTF-8''${encodedFilename}`,
      );

      if (typeof result.data === "string") {
        return c.body(result.data);
      }
      // Convert Node.js Buffer to Uint8Array for Hono compatibility
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
