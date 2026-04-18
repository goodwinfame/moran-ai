"use client";

import { useState, useCallback } from "react";
import { API_BASE } from "@/lib/api";

/** 支持的导出格式 */
export interface ExportFormatInfo {
  id: string;
  label: string;
  mimeType: string;
  extension: string;
}

/** 导出范围 */
export interface ExportRange {
  start?: number;
  end?: number;
}

/** 导出状态 */
export type ExportStatus = "idle" | "loading" | "success" | "error";

/**
 * 导出小说的 hook
 *
 * 通过构建下载 URL 触发浏览器下载（不经过 JSON API）。
 */
export function useExport(projectId: string | undefined) {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  /** 可用格式列表 */
  const formats: ExportFormatInfo[] = [
    {
      id: "epub",
      label: "EPUB \u7535\u5B50\u4E66",
      mimeType: "application/epub+zip",
      extension: ".epub",
    },
    {
      id: "txt",
      label: "TXT \u7EAF\u6587\u672C",
      mimeType: "text/plain",
      extension: ".txt",
    },
    {
      id: "markdown",
      label: "Markdown",
      mimeType: "text/markdown",
      extension: ".md",
    },
  ];

  /**
   * 触发导出下载
   */
  const download = useCallback(
    async (format: string, range?: ExportRange) => {
      if (!projectId) {
        setError("\u672A\u9009\u62E9\u9879\u76EE");
        return;
      }

      setStatus("loading");
      setError(null);

      try {
        // 构建 URL
        const params = new URLSearchParams();
        if (range?.start !== undefined) {
          params.set("start", String(range.start));
        }
        if (range?.end !== undefined) {
          params.set("end", String(range.end));
        }
        const queryStr = params.toString();
        const url = `${API_BASE}/api/projects/${projectId}/export/${format}${queryStr ? `?${queryStr}` : ""}`;

        const res = await fetch(url);

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error ?? `\u5BFC\u51FA\u5931\u8D25 (${res.status})`);
        }

        // 从 Content-Disposition 提取文件名
        const disposition = res.headers.get("content-disposition") ?? "";
        let filename = `export.${format === "markdown" ? "md" : format}`;

        // 尝试解析 filename*=UTF-8'' 格式
        const utf8Match = disposition.match(/filename\*=UTF-8''(.+)/i);
        if (utf8Match?.[1]) {
          filename = decodeURIComponent(utf8Match[1]);
        }

        // 触发浏览器下载
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);

        setStatus("success");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "\u5BFC\u51FA\u5931\u8D25";
        setError(msg);
        setStatus("error");
      }
    },
    [projectId],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return { formats, status, error, download, reset };
}
