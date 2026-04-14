"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

// ── Types ──────────────────────────────────────────

export interface TimelineItem {
  id: string;
  content: string;
  title: string;
  group: string;
  start: string;
  end: string | null;
  type: "point" | "range" | "box";
  className: string;
  chapterNumber: number | null;
  significance: "major" | "minor" | "turning_point";
}

export interface TimelineGroup {
  id: string;
  content: string;
  order: number;
}

interface TimelineResponse {
  items: TimelineItem[];
  groups: TimelineGroup[];
  total: number;
}

// ── Hook ───────────────────────────────────────────

export function useTimeline(projectId: string | null) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [groups, setGroups] = useState<TimelineGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeline = useCallback(async () => {
    if (!projectId) {
      setItems([]);
      setGroups([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<TimelineResponse>(
        `/api/projects/${projectId}/timeline`,
      );
      setItems(data.items);
      setGroups(data.groups);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载时间线数据失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchTimeline();
  }, [fetchTimeline]);

  return { items, groups, loading, error, refetch: fetchTimeline };
}
