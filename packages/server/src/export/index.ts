/**
 * 导出模块 — EPUB / TXT / Markdown
 */

export * from "./types.js";
export { generateEpub, contentToHtml, escapeHtml } from "./epub-generator.js";
export { generateTxt } from "./txt-generator.js";
export { generateMarkdown } from "./markdown-generator.js";

import type { ExportOptions, ExportResult, ExportFormat } from "./types.js";
import { generateEpub } from "./epub-generator.js";
import { generateTxt } from "./txt-generator.js";
import { generateMarkdown } from "./markdown-generator.js";

/** 支持的导出格式列表 */
export const SUPPORTED_FORMATS: ExportFormat[] = ["epub", "txt", "markdown"];

/**
 * 统一导出入口 — 按 format 分发到对应生成器
 */
export async function exportNovel(options: ExportOptions): Promise<ExportResult> {
  // 按范围过滤章节
  let chapters = options.chapters;
  if (options.startChapter !== undefined) {
    chapters = chapters.filter((ch) => ch.chapterNumber >= (options.startChapter as number));
  }
  if (options.endChapter !== undefined) {
    chapters = chapters.filter((ch) => ch.chapterNumber <= (options.endChapter as number));
  }

  // 排序
  chapters = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);

  if (chapters.length === 0) {
    throw new Error("No chapters to export");
  }

  switch (options.format) {
    case "epub":
      return generateEpub(
        options.title,
        options.author,
        chapters,
        options.description,
        options.lang,
      );

    case "txt":
      return generateTxt(options.title, options.author, chapters);

    case "markdown":
      return generateMarkdown(
        options.title,
        options.author,
        chapters,
        options.description,
      );

    default: {
      const _exhaustive: never = options.format;
      throw new Error(`Unsupported export format: ${_exhaustive}`);
    }
  }
}
