"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { DIMENSION_LABELS, ALL_DIMENSIONS, type AnalysisDimension, type AnalysisListItem, type CompareEntry } from "@/hooks/use-analysis";
import { Lightbulb, ArrowLeftRight } from "lucide-react";

interface ComparisonViewProps {
  /** Available analyses for selection */
  analyses: AnalysisListItem[];
  /** Comparison result entries */
  entries: CompareEntry[];
  /** Currently selected dimension */
  selectedDimension: AnalysisDimension | null;
  /** Currently selected analysis IDs */
  selectedIds: string[];
  onDimensionChange: (dim: AnalysisDimension) => void;
  onSelectionChange: (ids: string[]) => void;
  loading: boolean;
}

/**
 * §5.3.5 — Multi-work same-dimension comparison view.
 */
export function ComparisonView({
  analyses,
  entries,
  selectedDimension,
  selectedIds,
  onDimensionChange,
  onSelectionChange,
  loading,
}: ComparisonViewProps) {
  const [showSelector, setShowSelector] = useState(true);

  const toggleAnalysis = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-sm font-semibold">多作品对比</h3>
        <button
          onClick={() => setShowSelector(!showSelector)}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
        >
          {showSelector ? "收起选择" : "展开选择"}
        </button>
      </div>

      {/* Selection controls */}
      {showSelector && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-3">
          {/* Dimension picker */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              对比维度
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_DIMENSIONS.map((dim) => (
                <button
                  key={dim}
                  onClick={() => onDimensionChange(dim)}
                  className={
                    selectedDimension === dim
                      ? "rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground"
                      : "rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/80"
                  }
                >
                  {DIMENSION_LABELS[dim].slice(2)}
                </button>
              ))}
            </div>
          </div>

          {/* Analysis picker */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              选择作品（至少2部）
            </label>
            <div className="flex flex-wrap gap-1.5">
              {analyses.map((a) => (
                <button
                  key={a.id}
                  onClick={() => toggleAnalysis(a.id)}
                  className={
                    selectedIds.includes(a.id)
                      ? "rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground"
                      : "rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/80"
                  }
                >
                  《{a.workTitle}》
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Comparison content */}
      {loading && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          加载对比数据…
        </div>
      )}

      {!loading && entries.length === 0 && selectedIds.length >= 2 && selectedDimension && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          暂无对比数据
        </div>
      )}

      {!loading && entries.length === 0 && (selectedIds.length < 2 || !selectedDimension) && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            选择至少两部作品和一个维度开始对比
          </p>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div
              key={entry.analysisId}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  《{entry.workTitle}》
                </Badge>
                <span className="text-xs text-muted-foreground">{entry.label}</span>
              </div>

              {/* Content preview */}
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {entry.content.slice(0, 500)}
                {entry.content.length > 500 ? "…" : ""}
              </div>

              {/* Insights */}
              {entry.actionableInsights.length > 0 && (
                <div className="mt-3 rounded-md bg-amber-50 dark:bg-amber-950/20 p-2.5">
                  <div className="mb-1 flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-200">
                    <Lightbulb className="h-3 w-3" />
                    建议
                  </div>
                  {entry.actionableInsights.map((insight, i) => (
                    <p key={`cmp-insight-${i}`} className="text-xs text-amber-700 dark:text-amber-300">
                      • {insight}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
