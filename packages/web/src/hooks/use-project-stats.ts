"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

/**
 * Writing progress stats
 */
export interface WritingProgress {
  totalWords: number;
  totalChapters: number;
  currentArc: number;
  averageWordsPerChapter: number;
  dailyAverage: number;
  targetWordCount: number;
  completionPercentage: number;
}

/**
 * Agent cost
 */
export interface AgentCost {
  agentId: string;
  agentName: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  invocations: number;
}

/**
 * Cost summary
 */
export interface CostSummary {
  totalCost: number;
  averageCostPerChapter: number;
  byAgent: AgentCost[];
  dailyTrend: Array<{ date: string; cost: number }>;
}

/**
 * UNM Health
 */
export interface UNMHealth {
  hot: number;
  warm: number;
  cold: number;
  total: number;
  byCategory: Record<string, { hot: number; warm: number; cold: number }>;
}

/**
 * Foreshadow item
 */
export interface ForeshadowItem {
  id: string;
  title: string;
  description: string;
  status: "PLANTED" | "DEVELOPING" | "RESOLVED" | "STALE";
  plantedChapter: number;
  resolvedChapter: number | null;
  relatedCharacters: string[];
}

/**
 * Combined project stats
 */
export interface ProjectStats {
  progress: WritingProgress;
  cost: CostSummary;
  unm: UNMHealth;
}

/**
 * Hook for fetching combined project stats.
 */
export function useProjectStats(projectId: string | null) {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!projectId) {
      setStats(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ProjectStats>(
        `/api/projects/${projectId}/stats`,
      );
      setStats(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载统计数据失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

/**
 * Hook for fetching foreshadow items.
 */
export function useForeshadow(projectId: string | null) {
  const [items, setItems] = useState<ForeshadowItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchForeshadow = useCallback(async () => {
    if (!projectId) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ items: ForeshadowItem[]; total: number }>(
        `/api/projects/${projectId}/stats/foreshadow`,
      );
      setItems(data.items);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载伏笔数据失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchForeshadow();
  }, [fetchForeshadow]);

  return { items, loading, error, refetch: fetchForeshadow };
}
