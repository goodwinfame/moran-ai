"use client";

import { cn } from "@/lib/utils";
import { Loader2, Check, Search, Brain, FileText, BookmarkPlus } from "lucide-react";
import { DIMENSION_LABELS, ALL_DIMENSIONS, type AnalysisProgressData } from "@/hooks/use-analysis";

interface AnalysisProgressProps {
  progress: AnalysisProgressData;
}

const stageConfig = {
  search: { label: "搜索素材", icon: Search },
  analyze: { label: "九维分析", icon: Brain },
  report: { label: "生成报告", icon: FileText },
  settle: { label: "沉淀知识", icon: BookmarkPlus },
} as const;

type StageKey = keyof typeof stageConfig;

const stageOrder: StageKey[] = ["search", "analyze", "report", "settle"];

/**
 * §5.3.5 — Analysis progress indicator.
 * Shows overall stage + per-dimension progress.
 */
export function AnalysisProgress({ progress }: AnalysisProgressProps) {
  const currentStageIdx = stageOrder.indexOf(progress.stage);
  const completedDimensions = new Set(progress.completedDimensions);

  return (
    <div className="space-y-4">
      {/* Overall progress bar */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium">{progress.message}</span>
          <span className="text-sm text-muted-foreground">
            {Math.round(progress.progress * 100)}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress.progress * 100}%` }}
          />
        </div>
      </div>

      {/* Stage indicators */}
      <div className="flex items-center justify-between">
        {stageOrder.map((stage, i) => {
          const config = stageConfig[stage];
          const Icon = config.icon;
          const isActive = stage === progress.stage;
          const isCompleted = i < currentStageIdx;

          return (
            <div key={stage} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                  isCompleted && "bg-primary text-primary-foreground",
                  isActive && "bg-primary/10 text-primary ring-2 ring-primary",
                  !isCompleted && !isActive && "bg-muted text-muted-foreground",
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span className={cn(
                "text-[10px]",
                isActive ? "font-medium text-primary" : "text-muted-foreground",
              )}>
                {config.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Per-dimension grid (only during analyze stage) */}
      {progress.stage === "analyze" && (
        <div className="grid grid-cols-3 gap-1.5">
          {ALL_DIMENSIONS.map((dim) => {
            const isComplete = completedDimensions.has(dim);
            const isCurrent = progress.dimension === dim && !isComplete;
            const label = DIMENSION_LABELS[dim];
            // Extract just the number and short name
            const shortLabel = label.slice(0, 6);

            return (
              <div
                key={dim}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-all",
                  isComplete && "bg-primary/10 text-primary",
                  isCurrent && "bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300",
                  !isComplete && !isCurrent && "bg-muted/50 text-muted-foreground",
                )}
              >
                {isComplete ? (
                  <Check className="h-3 w-3 shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                ) : (
                  <div className="h-3 w-3 shrink-0 rounded-full border border-current opacity-30" />
                )}
                <span className="truncate">{shortLabel}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
