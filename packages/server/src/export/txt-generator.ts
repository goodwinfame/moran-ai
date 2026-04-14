/**
 * TXT 纯文本导出生成器
 *
 * 最简单的导出格式：标题 + 章节正文，无格式。
 */

import type { ExportChapter, ExportResult } from "./types.js";

/** 分隔线 */
const SEPARATOR = "\n\n" + "=".repeat(40) + "\n\n";

/**
 * 生成 TXT 纯文本导出
 */
export function generateTxt(
  title: string,
  author: string,
  chapters: ExportChapter[],
): ExportResult {
  const parts: string[] = [];

  // 书名 + 作者
  parts.push(title);
  parts.push(`\u4F5C\u8005\uFF1A${author}`);
  parts.push(`\u5171 ${chapters.length} \u7AE0`);
  parts.push(SEPARATOR);

  // 各章
  for (const ch of chapters) {
    const chTitle = ch.title
      ? `\u7B2C${ch.chapterNumber}\u7AE0 ${ch.title}`
      : `\u7B2C${ch.chapterNumber}\u7AE0`;
    parts.push(chTitle);
    parts.push("");
    parts.push(ch.content);
    parts.push(SEPARATOR);
  }

  const text = parts.join("\n");

  return {
    data: text,
    mimeType: "text/plain; charset=utf-8",
    filename: `${title}.txt`,
  };
}
