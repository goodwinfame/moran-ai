/**
 * EPUB 电子书导出生成器
 *
 * 使用 epub-gen-memory 生成 EPUB 3.0 格式电子书。
 * 支持中文内容、章节目录、基础样式。
 */

import epub from "epub-gen-memory";
import type { Options, Chapter } from "epub-gen-memory";
import type { ExportChapter, ExportResult } from "./types.js";

/**
 * 默认 EPUB CSS — 针对中文排版优化
 */
const DEFAULT_CSS = `
body {
  font-family: "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 1em;
  line-height: 1.8;
  text-align: justify;
  margin: 1em;
  color: #333;
}
h1, h2, h3 {
  font-weight: bold;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}
h1 { font-size: 1.6em; text-align: center; }
h2 { font-size: 1.3em; }
p {
  text-indent: 2em;
  margin: 0.5em 0;
}
`.trim();

/**
 * 将章节正文转为 EPUB 兼容的 HTML
 *
 * 处理：换行 → <p> 标签，保留段落缩进
 */
function contentToHtml(content: string): string {
  const paragraphs = content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n");
}

/**
 * 基础 HTML 转义
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 生成 EPUB 电子书
 */
export async function generateEpub(
  title: string,
  author: string,
  chapters: ExportChapter[],
  description?: string,
  lang?: string,
): Promise<ExportResult> {
  const options: Options = {
    title,
    author: [author],
    lang: lang ?? "zh",
    description: description ?? "",
    css: DEFAULT_CSS,
    tocTitle: "\u76EE\u5F55",
    prependChapterTitles: false,
    date: new Date().toISOString().slice(0, 10),
    verbose: false,
  };

  const epubChapters: Chapter[] = chapters.map((ch) => {
    const chTitle = ch.title
      ? `\u7B2C${ch.chapterNumber}\u7AE0 ${ch.title}`
      : `\u7B2C${ch.chapterNumber}\u7AE0`;

    return {
      title: chTitle,
      content: contentToHtml(ch.content),
    };
  });

  const buffer = await epub(options, epubChapters);

  return {
    data: buffer,
    mimeType: "application/epub+zip",
    filename: `${title}.epub`,
  };
}

// Re-export for testing
export { contentToHtml, escapeHtml, DEFAULT_CSS };
