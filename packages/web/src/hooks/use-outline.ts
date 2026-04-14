"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

// ── Types ──────────────────────────────────────────

export interface OutlineData {
  id: string;
  projectId: string;
  synopsis: string;
  structureType: string;
  themes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ArcData {
  id: string;
  projectId: string;
  arcIndex: number;
  title: string;
  description: string;
  startChapter: number;
  endChapter: number;
  detailedPlan: string;
  createdAt: string;
  updatedAt: string;
}

interface OutlineResponse {
  outline: OutlineData | null;
  arcs: ArcData[];
  totalArcs: number;
}

// ── Hook ──────────────────────────────────────────

export function useOutline(projectId: string | null) {
  const [outline, setOutline] = useState<OutlineData | null>(null);
  const [arcs, setArcs] = useState<ArcData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOutline = useCallback(async () => {
    if (!projectId) {
      setOutline(null);
      setArcs([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<OutlineResponse>(
        `/api/projects/${projectId}/outline`,
      );
      setOutline(data.outline);
      setArcs(data.arcs);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载大纲失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchOutline();
  }, [fetchOutline]);

  const updateOutline = useCallback(
    async (data: Partial<OutlineData>) => {
      if (!projectId) return null;
      try {
        const result = await api.put<OutlineData>(
          `/api/projects/${projectId}/outline`,
          data,
        );
        setOutline(result);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "更新大纲失败";
        setError(msg);
        return null;
      }
    },
    [projectId],
  );

  const createArc = useCallback(
    async (data: { title: string; description?: string; startChapter?: number; endChapter?: number; detailedPlan?: string }) => {
      if (!projectId) return null;
      try {
        const result = await api.post<ArcData>(
          `/api/projects/${projectId}/outline/arcs`,
          data,
        );
        await fetchOutline();
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "创建弧段失败";
        setError(msg);
        return null;
      }
    },
    [projectId, fetchOutline],
  );

  const updateArc = useCallback(
    async (arcIndex: number, data: Partial<ArcData>) => {
      if (!projectId) return null;
      try {
        const result = await api.put<ArcData>(
          `/api/projects/${projectId}/outline/arcs/${arcIndex}`,
          data,
        );
        await fetchOutline();
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "更新弧段失败";
        setError(msg);
        return null;
      }
    },
    [projectId, fetchOutline],
  );

  const deleteArc = useCallback(
    async (arcIndex: number) => {
      if (!projectId) return;
      try {
        await api.delete(`/api/projects/${projectId}/outline/arcs/${arcIndex}`);
        await fetchOutline();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "删除弧段失败";
        setError(msg);
      }
    },
    [projectId, fetchOutline],
  );

  return { outline, arcs, loading, error, refetch: fetchOutline, updateOutline, createArc, updateArc, deleteArc };
}
