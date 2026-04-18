"use client";

import { useState, useEffect, useCallback } from "react";
import { api, API_BASE } from "@/lib/api";

// ── Types (mirroring server route) ─────────────────

export type AnalysisDimension =
  | "narrative_structure"
  | "character_design"
  | "world_building"
  | "foreshadowing"
  | "pacing_tension"
  | "shuanggan_mechanics"
  | "style_fingerprint"
  | "dialogue_voice"
  | "chapter_hooks";

export const DIMENSION_LABELS: Record<AnalysisDimension, string> = {
  narrative_structure: "① 叙事结构分析",
  character_design: "② 角色设计技法",
  world_building: "③ 世界观构建",
  foreshadowing: "④ 伏笔与线索",
  pacing_tension: "⑤ 节奏与张力",
  shuanggan_mechanics: "⑥ 爽感机制",
  style_fingerprint: "⑦ 文风指纹",
  dialogue_voice: "⑧ 对话与声音",
  chapter_hooks: "⑨ 章末钩子",
};

export const ALL_DIMENSIONS: AnalysisDimension[] = [
  "narrative_structure",
  "character_design",
  "world_building",
  "foreshadowing",
  "pacing_tension",
  "shuanggan_mechanics",
  "style_fingerprint",
  "dialogue_voice",
  "chapter_hooks",
];

export interface DimensionResult {
  dimension: AnalysisDimension;
  label: string;
  content: string;
  actionableInsights: string[];
  consumers: string[];
}

export interface WritingTechnique {
  id: string;
  title: string;
  description: string;
  sourceDimension: AnalysisDimension;
  category: "writing_technique" | "genre_knowledge" | "style_guide" | "reference_analysis";
  settled: boolean;
}

export interface WorkMetadata {
  title: string;
  author: string;
  tags: string[];
  synopsis: string;
  wordCount?: number;
  rating?: number;
  platform?: string;
}

export type AnalysisStatus =
  | "pending"
  | "searching"
  | "analyzing"
  | "reporting"
  | "settling"
  | "completed"
  | "failed";

export interface AnalysisProgressData {
  stage: "search" | "analyze" | "report" | "settle";
  dimension?: AnalysisDimension;
  message: string;
  progress: number;
  completedDimensions: AnalysisDimension[];
}

/** Analysis list item (from GET /analysis) */
export interface AnalysisListItem {
  id: string;
  workTitle: string;
  author: string;
  status: AnalysisStatus;
  dimensionCount: number;
  techniqueCount: number;
  createdAt: string;
}

/** Full analysis record (from GET /analysis/:id) */
export interface AnalysisRecord {
  id: string;
  projectId: string;
  work: WorkMetadata;
  status: AnalysisStatus;
  dimensions: DimensionResult[];
  techniques: WritingTechnique[];
  overallSummary: string;
  progress: AnalysisProgressData;
  totalUsage: { inputTokens: number; outputTokens: number };
  createdAt: string;
  updatedAt: string;
}

/** Comparison entry */
export interface CompareEntry {
  analysisId: string;
  workTitle: string;
  dimension: AnalysisDimension;
  label: string;
  content: string;
  actionableInsights: string[];
}

// ── Hooks ──────────────────────────────────────────

interface AnalysisListResponse {
  analyses: AnalysisListItem[];
  total: number;
}

/**
 * Hook for fetching analysis list for a project.
 */
export function useAnalysisList(projectId: string | null) {
  const [analyses, setAnalyses] = useState<AnalysisListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyses = useCallback(async () => {
    if (!projectId) {
      setAnalyses([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.get<AnalysisListResponse>(
        `/api/projects/${projectId}/analysis`,
      );
      setAnalyses(data.analyses);
      setTotal(data.total);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载分析列表失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchAnalyses();
  }, [fetchAnalyses]);

  return { analyses, total, loading, error, refetch: fetchAnalyses };
}

/**
 * Hook for fetching a single analysis detail.
 */
export function useAnalysisDetail(projectId: string | null, analysisId: string | null) {
  const [analysis, setAnalysis] = useState<AnalysisRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!projectId || !analysisId) {
      setAnalysis(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.get<AnalysisRecord>(
        `/api/projects/${projectId}/analysis/${analysisId}`,
      );
      setAnalysis(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载分析详情失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId, analysisId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  /** Submit a new analysis */
  const submitAnalysis = useCallback(async (req: {
    workTitle: string;
    authorName?: string;
    userNotes?: string;
    providedTexts?: string[];
    dimensions?: AnalysisDimension[];
  }) => {
    if (!projectId) return null;
    setLoading(true);
    setError(null);
    try {
      const data = await api.post<AnalysisRecord>(
        `/api/projects/${projectId}/analysis`,
        req,
      );
      setAnalysis(data);
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "提交分析失败";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  /** Settle techniques to knowledge base */
  const settleTechniques = useCallback(async (techniqueIds?: string[]) => {
    if (!projectId || !analysisId) return;
    try {
      await api.post(
        `/api/projects/${projectId}/analysis/${analysisId}/settle`,
        techniqueIds ? { techniqueIds } : {},
      );
      // Refetch to get updated settle states
      await fetchDetail();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "沉淀知识库失败";
      setError(msg);
    }
  }, [projectId, analysisId, fetchDetail]);

  /** Export analysis as Markdown (returns text) */
  const exportMarkdown = useCallback(async (): Promise<string | null> => {
    if (!projectId || !analysisId) return null;
    try {
      const res = await fetch(
        `${API_BASE}/api/projects/${projectId}/analysis/${analysisId}/export`,
      );
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }, [projectId, analysisId]);

  return {
    analysis,
    loading,
    error,
    refetch: fetchDetail,
    submitAnalysis,
    settleTechniques,
    exportMarkdown,
  };
}

/**
 * Hook for multi-work dimension comparison.
 */
export function useAnalysisCompare(
  projectId: string | null,
  analysisIds: string[],
  dimension: AnalysisDimension | null,
) {
  const [entries, setEntries] = useState<CompareEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCompare = useCallback(async () => {
    if (!projectId || analysisIds.length < 2 || !dimension) {
      setEntries([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ entries: CompareEntry[] }>(
        `/api/projects/${projectId}/analysis/compare?ids=${analysisIds.join(",")}&dimension=${dimension}`,
      );
      setEntries(data.entries);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载对比数据失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId, analysisIds, dimension]);

  useEffect(() => {
    void fetchCompare();
  }, [fetchCompare]);

  return { entries, loading, error, refetch: fetchCompare };
}
