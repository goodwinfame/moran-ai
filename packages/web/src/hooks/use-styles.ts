"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

// ── Types ──────────────────────────────────────────

export interface StyleListItem {
  styleId: string;
  displayName: string;
  genre: string;
  description: string;
  source: "builtin" | "user" | "fork";
  forkedFrom: string | null;
}

export interface StyleDetail extends StyleListItem {
  version: number;
  modules: string[];
  reviewerFocus: string[];
  contextWeights: Record<string, number>;
  tone: Record<string, number>;
  forbidden: { words?: string[]; patterns?: string[] };
  encouraged: string[];
  proseGuide: string;
  examples: string;
  createdAt: string;
  updatedAt: string;
}

interface StyleListResponse {
  styles: StyleListItem[];
  total: number;
}

// ── Hook: Style List ──────────────────────────────

export function useStyles(projectId: string | null) {
  const [styles, setStyles] = useState<StyleListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStyles = useCallback(async () => {
    if (!projectId) {
      setStyles([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<StyleListResponse>(
        `/api/projects/${projectId}/styles`,
      );
      setStyles(data.styles);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载风格列表失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchStyles();
  }, [fetchStyles]);

  return { styles, loading, error, refetch: fetchStyles };
}

// ── Hook: Style Detail + Actions ──────────────────

export function useStyleDetail(projectId: string | null, styleId: string | null) {
  const [style, setStyle] = useState<StyleDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!projectId || !styleId) {
      setStyle(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<StyleDetail>(
        `/api/projects/${projectId}/styles/${styleId}`,
      );
      setStyle(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载风格详情失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId, styleId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const updateStyle = useCallback(
    async (data: Partial<StyleDetail>) => {
      if (!projectId || !styleId) return null;
      try {
        const result = await api.put<StyleDetail>(
          `/api/projects/${projectId}/styles/${styleId}`,
          data,
        );
        setStyle(result);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "更新风格失败";
        setError(msg);
        return null;
      }
    },
    [projectId, styleId],
  );

  const forkStyle = useCallback(
    async (displayName?: string) => {
      if (!projectId || !styleId) return null;
      try {
        const result = await api.post<StyleDetail>(
          `/api/projects/${projectId}/styles/${styleId}/fork`,
          displayName ? { displayName } : {},
        );
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Fork 风格失败";
        setError(msg);
        return null;
      }
    },
    [projectId, styleId],
  );

  const createStyle = useCallback(
    async (data: { displayName: string; genre?: string; description?: string; proseGuide?: string; examples?: string }) => {
      if (!projectId) return null;
      try {
        const result = await api.post<StyleDetail>(
          `/api/projects/${projectId}/styles`,
          data,
        );
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "创建风格失败";
        setError(msg);
        return null;
      }
    },
    [projectId],
  );

  const deleteStyle = useCallback(
    async (id: string) => {
      if (!projectId) return;
      try {
        await api.delete(`/api/projects/${projectId}/styles/${id}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "删除风格失败";
        setError(msg);
      }
    },
    [projectId],
  );

  return { style, loading, error, refetch: fetchDetail, updateStyle, forkStyle, createStyle, deleteStyle };
}
