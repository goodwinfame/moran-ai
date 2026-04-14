/**
 * 导出模块类型定义
 *
 * 支持三种导出格式：EPUB、TXT、Markdown
 */

/** 支持的导出格式 */
export type ExportFormat = "epub" | "txt" | "markdown";

/** 章节数据（导出所需的最小字段） */
export interface ExportChapter {
  chapterNumber: number;
  title: string | null;
  content: string;
  wordCount: number;
}

/** 导出请求配置 */
export interface ExportOptions {
  /** 项目标题 */
  title: string;
  /** 作者名 */
  author: string;
  /** 语言代码 */
  lang: string;
  /** 项目描述 */
  description?: string;
  /** 章节列表（已按 chapterNumber 排序） */
  chapters: ExportChapter[];
  /** 起始章节号（含） */
  startChapter?: number;
  /** 结束章节号（含） */
  endChapter?: number;
  /** 导出格式 */
  format: ExportFormat;
}

/** 导出结果 */
export interface ExportResult {
  /** 文件内容（Buffer 或 string） */
  data: Buffer | string;
  /** MIME 类型 */
  mimeType: string;
  /** 推荐文件名 */
  filename: string;
}
