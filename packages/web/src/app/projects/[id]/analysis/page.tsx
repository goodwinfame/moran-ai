"use client";

import { useParams } from "next/navigation";
import { useState, useCallback } from "react";
import {
  useAnalysisList,
  useAnalysisDetail,
  type AnalysisDimension,
} from "@/hooks/use-analysis";
import { AnalysisHistorySidebar } from "@/components/analysis/analysis-history-sidebar";
import { AnalysisSubmitForm } from "@/components/analysis/analysis-submit-form";
import { AnalysisProgress } from "@/components/analysis/analysis-progress";
import { AnalysisSummary } from "@/components/analysis/analysis-summary";
import { DimensionReport } from "@/components/analysis/dimension-report";
import { TechniqueCards } from "@/components/analysis/technique-cards";
import { Icon } from "@/components/ui/icon";

/**
 * §5.3.5 — 析典（九维深度分析）
 *
 * Layout: left sidebar (history list) + main area (submit / progress / results).
 * Flow: select existing → view detail, or "新建分析" → submit form → progress → results.
 */
export default function AnalysisPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSubmitForm, setShowSubmitForm] = useState(false);

  const {
    analyses,
    loading: listLoading,
    refetch: refetchList,
  } = useAnalysisList(projectId);

  const {
    analysis,
    loading: detailLoading,
    submitAnalysis,
    settleTechniques,
    exportMarkdown,
    refetch: refetchDetail,
  } = useAnalysisDetail(projectId, selectedId);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setShowSubmitForm(false);
  }, []);

  const handleNewAnalysis = useCallback(() => {
    setSelectedId(null);
    setShowSubmitForm(true);
  }, []);

  const handleSubmit = useCallback(
    async (data: {
      workTitle: string;
      authorName?: string;
      userNotes?: string;
      providedTexts?: string[];
      dimensions?: AnalysisDimension[];
    }) => {
      const result = await submitAnalysis(data);
      if (result) {
        setSelectedId(result.id);
        setShowSubmitForm(false);
        void refetchList();
      }
    },
    [submitAnalysis, refetchList],
  );

  const handleExport = useCallback(async () => {
    const md = await exportMarkdown();
    if (!md) return;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analysis-${selectedId ?? "export"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportMarkdown, selectedId]);

  const isInProgress =
    analysis &&
    (analysis.status === "pending" ||
      analysis.status === "searching" ||
      analysis.status === "analyzing" ||
      analysis.status === "reporting" ||
      analysis.status === "settling");

  const isCompleted = analysis?.status === "completed";

  return (
    <div className="flex h-full">
      {/* Left sidebar: history + new button */}
      <div className="flex w-72 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium">分析历史</h2>
          <button
            onClick={handleNewAnalysis}
            className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Icon name="add" size={14} />
            新建
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <AnalysisHistorySidebar
            analyses={analyses}
            loading={listLoading}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 overflow-y-auto bg-muted/30">
        {/* Empty state: no selection and no submit form */}
        {!selectedId && !showSubmitForm && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-card shadow-sm">
              <Icon name="analytics" size={28} className="text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">九维深度分析</h3>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              选择一条历史记录查看详情，或点击"新建"开始分析一部作品
            </p>
          </div>
        )}

        {/* Submit form */}
        {showSubmitForm && (
          <div className="mx-auto max-w-2xl px-6 py-8">
            <h2 className="mb-6 text-xl font-semibold">新建作品分析</h2>
            <AnalysisSubmitForm onSubmit={handleSubmit} loading={detailLoading} />
          </div>
        )}

        {/* Detail view: in-progress */}
        {selectedId && isInProgress && analysis && (
          <div className="mx-auto max-w-2xl px-6 py-8">
            <h2 className="mb-6 text-xl font-semibold">
              分析进行中：{analysis.work.title}
            </h2>
            <AnalysisProgress progress={analysis.progress} />
            <div className="mt-4 text-center">
              <button
                onClick={() => void refetchDetail()}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon name="refresh" size={14} className="mr-1 inline" />
                刷新状态
              </button>
            </div>
          </div>
        )}

        {/* Detail view: completed */}
        {selectedId && isCompleted && analysis && (
          <div className="mx-auto max-w-4xl px-6 py-8 space-y-8">
            <AnalysisSummary
              work={analysis.work}
              overallSummary={analysis.overallSummary}
              totalUsage={analysis.totalUsage}
              createdAt={analysis.createdAt}
              onExport={handleExport}
            />
            <DimensionReport dimensions={analysis.dimensions} />
            <TechniqueCards
              techniques={analysis.techniques}
              onSettle={settleTechniques}
              loading={detailLoading}
            />
          </div>
        )}

        {/* Detail view: failed */}
        {selectedId && analysis?.status === "failed" && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
              <Icon name="error" size={28} className="text-destructive" />
            </div>
            <h3 className="text-lg font-medium">分析失败</h3>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              {analysis.work.title} 的分析过程中出现错误，请重试。
            </p>
          </div>
        )}

        {/* Loading detail */}
        {selectedId && detailLoading && !analysis && (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
