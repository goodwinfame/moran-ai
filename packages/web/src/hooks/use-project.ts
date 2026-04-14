"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useProjectStore, type ProjectInfo } from "@/stores/project-store";

/**
 * Raw project data from API (also used by manage panel).
 */
export interface ProjectListItem {
  id: string;
  title: string;
  genre: string | null;
  totalWordCount: number;
  currentChapter: number;
  currentArc: number;
  status: string;
  targetWordCount: number;
}

type ProjectResponse = ProjectListItem;

interface ProjectListResponse {
  projects: ProjectListItem[];
  total: number;
}

function toProjectInfo(p: ProjectResponse): ProjectInfo {
  return {
    id: p.id,
    name: p.title,
    genre: p.genre ?? "未分类",
    totalWords: p.totalWordCount,
    chapterCount: p.currentChapter,
    currentArc: p.currentArc,
    status: (p.status === "writing" || p.status === "reviewing" || p.status === "archiving")
      ? p.status
      : "idle",
  };
}

/**
 * Hook for fetching and managing project data.
 * Syncs with Zustand project store.
 */
export function useProjects() {
  const { projects, setProjects, currentProject, setCurrentProject } = useProjectStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ProjectListResponse>("/api/projects");
      const mapped = data.projects.map(toProjectInfo);
      setProjects(mapped);
      // Auto-select first if none selected
      if (!currentProject && mapped.length > 0) {
        setCurrentProject(mapped[0] ?? null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载项目失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [setProjects, currentProject, setCurrentProject]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  return { projects, currentProject, setCurrentProject, loading, error, refetch: fetchProjects };
}
