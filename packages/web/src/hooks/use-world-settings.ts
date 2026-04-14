"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

// ── Types ──────────────────────────────────────────

export interface WorldSetting {
  id: string;
  projectId: string;
  section: string;
  name: string;
  content: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface WorldListResponse {
  settings: WorldSetting[];
  total: number;
}

// ── Hook ──────────────────────────────────────────

export function useWorldSettings(projectId: string | null) {
  const [settings, setSettings] = useState<WorldSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!projectId) {
      setSettings([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<WorldListResponse>(
        `/api/projects/${projectId}/world`,
      );
      setSettings(data.settings);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载世界设定失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  const createSetting = useCallback(
    async (data: { section: string; name: string; content: string; sortOrder?: number }) => {
      if (!projectId) return null;
      try {
        const result = await api.post<WorldSetting>(
          `/api/projects/${projectId}/world`,
          data,
        );
        await fetchSettings();
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "创建设定失败";
        setError(msg);
        return null;
      }
    },
    [projectId, fetchSettings],
  );

  const updateSetting = useCallback(
    async (settingId: string, data: Partial<WorldSetting>) => {
      if (!projectId) return null;
      try {
        const result = await api.put<WorldSetting>(
          `/api/projects/${projectId}/world/${settingId}`,
          data,
        );
        await fetchSettings();
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "更新设定失败";
        setError(msg);
        return null;
      }
    },
    [projectId, fetchSettings],
  );

  const deleteSetting = useCallback(
    async (settingId: string) => {
      if (!projectId) return;
      try {
        await api.delete(`/api/projects/${projectId}/world/${settingId}`);
        await fetchSettings();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "删除设定失败";
        setError(msg);
      }
    },
    [projectId, fetchSettings],
  );

  return { settings, loading, error, refetch: fetchSettings, createSetting, updateSetting, deleteSetting };
}
