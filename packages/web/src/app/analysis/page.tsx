"use client";

import { useState, useCallback } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AnalysisSubmitForm, type SubmitAnalysisData } from "@/components/analysis/analysis-submit-form";
import { AnalysisHistorySidebar } from "@/components/analysis/analysis-history-sidebar";
import { DimensionReport } from "@/components/analysis/dimension-report";
import { TechniqueCards } from "@/components/analysis/technique-cards";
import { AnalysisProgress } from "@/components/analysis/analysis-progress";
import { AnalysisSummary } from "@/components/analysis/analysis-summary";
import { ComparisonView } from "@/components/analysis/comparison-view";
import { useAnalysisList, useAnalysisDetail, useAnalysisCompare, type AnalysisDimension } from "@/hooks/use-analysis";
import { useProjectStore } from "@/stores/project-store";
import { Plus } from "lucide-react";

export default function AnalysisPage() {
  const { currentProject } = useProjectStore();
  const projectId = currentProject?.id ?? null;

  // Analysis list + detail
  const { analyses, loading: listLoading, refetch: refetchList } = useAnalysisList(projectId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const {
    analysis,
    loading: detailLoading,
    submitAnalysis,
    settleTechniques,
    exportMarkdown,
  } = useAnalysisDetail(projectId, selectedId);

  // Comparison state
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareDimension, setCompareDimension] = useState<AnalysisDimension | null>(null);
  const { entries: compareEntries, loading: compareLoading } = useAnalysisCompare(
    projectId,
    compareIds,
    compareDimension,
  );

  // Tab state
  const [activeTab, setActiveTab] = useState<string>("report");

  const handleSubmit = useCallback(async (data: SubmitAnalysisData) => {
    const result = await submitAnalysis(data);
    if (result) {
      setSelectedId(result.id);
      setShowSubmitForm(false);
      await refetchList();
    }
  }, [submitAnalysis, refetchList]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setShowSubmitForm(false);
    setActiveTab("report");
  }, []);

  const handleSettle = useCallback(async (techniqueIds: string[]) => {
    await settleTechniques(techniqueIds);
  }, [settleTechniques]);

  const handleExport = useCallback(async () => {
    const md = await exportMarkdown();
    if (md) {
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${analysis?.work.title ?? "analysis"}-report.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [exportMarkdown, analysis]);

  const showDetail = analysis && !showSubmitForm;
  const isInProgress = analysis && analysis.status !== "completed" && analysis.status !== "failed";

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="📊 分析"
        description="参考作品深度分析 — 九维文学分析框架"
        actions={
          <Button
            size="sm"
            onClick={() => {
              setShowSubmitForm(true);
              setSelectedId(null);
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            提交新分析
          </Button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: history + submit form */}
        <aside className="w-72 shrink-0 border-r border-border bg-muted/30 flex flex-col">
          {/* Submit form toggle zone */}
          {showSubmitForm && (
            <div className="border-b border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">提交新分析</h3>
                <button
                  onClick={() => setShowSubmitForm(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  取消
                </button>
              </div>
              <AnalysisSubmitForm
                onSubmit={handleSubmit}
                loading={detailLoading}
              />
            </div>
          )}

          {/* History list */}
          <div className="flex-1 overflow-hidden">
            <div className="px-4 pt-3 pb-2">
              <h3 className="text-sm font-semibold text-muted-foreground">分析历史</h3>
            </div>
            <AnalysisHistorySidebar
              analyses={analyses}
              loading={listLoading}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </div>
        </aside>

        {/* Right: report area */}
        <div className="flex-1 overflow-auto">
          {/* Empty state */}
          {!showDetail && !showSubmitForm && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 rounded-lg border border-dashed border-border p-12">
                  <p className="text-lg text-muted-foreground">
                    提交参考作品进行九维分析
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    叙事结构 · 角色设计 · 世界观 · 伏笔技巧 · 节奏张力
                  </p>
                  <p className="text-sm text-muted-foreground">
                    爽感机制 · 文风指纹 · 对话声音 · 章末钩子
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowSubmitForm(true)}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  开始新分析
                </Button>
              </div>
            </div>
          )}

          {/* Submit form empty state */}
          {!showDetail && showSubmitForm && (
            <div className="flex h-full items-center justify-center p-8">
              <div className="max-w-md text-center">
                <p className="text-lg text-muted-foreground mb-2">
                  填写左侧表单提交分析
                </p>
                <p className="text-sm text-muted-foreground">
                  析典会自动搜索作品信息，结合你提供的文本片段进行九维深度分析
                </p>
              </div>
            </div>
          )}

          {/* Analysis detail */}
          {showDetail && (
            <div className="p-6">
              <div className="mx-auto max-w-4xl space-y-6">
                {/* Progress (if still running) */}
                {isInProgress && (
                  <AnalysisProgress progress={analysis.progress} />
                )}

                {/* Summary card */}
                <AnalysisSummary
                  work={analysis.work}
                  overallSummary={analysis.overallSummary}
                  totalUsage={analysis.totalUsage}
                  createdAt={analysis.createdAt}
                  onExport={handleExport}
                />

                {/* Tabbed content */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="report">
                      九维报告
                    </TabsTrigger>
                    <TabsTrigger value="techniques">
                      写作技法 ({analysis.techniques.length})
                    </TabsTrigger>
                    <TabsTrigger value="compare">
                      对比视图
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="report" className="mt-4">
                    <DimensionReport dimensions={analysis.dimensions} />
                  </TabsContent>

                  <TabsContent value="techniques" className="mt-4">
                    <TechniqueCards
                      techniques={analysis.techniques}
                      onSettle={handleSettle}
                    />
                  </TabsContent>

                  <TabsContent value="compare" className="mt-4">
                    <ComparisonView
                      analyses={analyses}
                      entries={compareEntries}
                      selectedDimension={compareDimension}
                      selectedIds={compareIds}
                      onDimensionChange={setCompareDimension}
                      onSelectionChange={setCompareIds}
                      loading={compareLoading}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
