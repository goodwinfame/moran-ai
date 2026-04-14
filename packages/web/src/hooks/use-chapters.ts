"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export interface ChapterSummary {
  id: string;
  projectId: string;
  chapterNumber: number;
  title: string | null;
  wordCount: number;
  writerStyle: string | null;
  status: string;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterDetail extends ChapterSummary {
  content: string | null;
}

interface ChapterListResponse {
  chapters: ChapterSummary[];
  total: number;
}

/**
 * Hook for fetching chapter list for a project.
 */
export function useChapters(projectId: string | null) {
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChapters = useCallback(async () => {
    if (!projectId) {
      setChapters([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ChapterListResponse>(
        `/api/projects/${projectId}/chapters`,
      );
      setChapters(data.chapters);
      setTotal(data.total);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载章节失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchChapters();
  }, [fetchChapters]);

  return { chapters, total, loading, error, refetch: fetchChapters };
}

/**
 * Hook for fetching a single chapter's full content.
 */
export function useChapterDetail(projectId: string | null, chapterNumber: number | null) {
  const [chapter, setChapter] = useState<ChapterDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChapter = useCallback(async () => {
    if (!projectId || chapterNumber === null) {
      setChapter(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ChapterDetail>(
        `/api/projects/${projectId}/chapters/${chapterNumber}`,
      );
      setChapter(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载章节详情失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId, chapterNumber]);

  useEffect(() => {
    void fetchChapter();
  }, [fetchChapter]);

  return { chapter, loading, error, refetch: fetchChapter };
}
