/**
 * Markdown 导出生成器
 *
 * 生成结构化 Markdown 文档：含目录、章节标题层级、字数统计。
 */

import type { ExportChapter, ExportResult } from "./types.js";

/**
 * 生成 Markdown 导出
 */
export function generateMarkdown(
  title: string,
  author: string,
  chapters: ExportChapter[],
  description?: string,
): ExportResult {
  const parts: string[] = [];

  // 封面信息
  parts.push(`# ${title}`);
  parts.push("");
  parts.push(`> \u4F5C\u8005\uFF1A${author}`);
  if (description) {
    parts.push(`> ${description}`);
  }

  const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
  parts.push(`> \u5171 ${chapters.length} \u7AE0\uFF0C${totalWords.toLocaleString()} \u5B57`);
  parts.push("");

  // 目录
  parts.push("---");
  parts.push("");
  parts.push("## \u76EE\u5F55");
  parts.push("");
  for (const ch of chapters) {
    const label = ch.title
      ? `\u7B2C${ch.chapterNumber}\u7AE0 ${ch.title}`
      : `\u7B2C${ch.chapterNumber}\u7AE0`;
    const anchor = `chapter-${ch.chapterNumber}`;
    parts.push(`- [${label}](#${anchor})`);
  }
  parts.push("");
  parts.push("---");
  parts.push("");

  // 各章正文
  for (const ch of chapters) {
    const chTitle = ch.title
      ? `\u7B2C${ch.chapterNumber}\u7AE0 ${ch.title}`
      : `\u7B2C${ch.chapterNumber}\u7AE0`;
    const anchor = `chapter-${ch.chapterNumber}`;
    parts.push(`## ${chTitle} {#${anchor}}`);
    parts.push("");
    parts.push(ch.content);
    parts.push("");
    parts.push(`*\u672C\u7AE0\u5B57\u6570\uFF1A${ch.wordCount.toLocaleString()}*`);
    parts.push("");
    parts.push("---");
    parts.push("");
  }

  const md = parts.join("\n");

  return {
    data: md,
    mimeType: "text/markdown; charset=utf-8",
    filename: `${title}.md`,
  };
}
