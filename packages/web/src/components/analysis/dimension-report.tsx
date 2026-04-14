"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Lightbulb } from "lucide-react";
import type { DimensionResult, AnalysisDimension } from "@/hooks/use-analysis";

interface DimensionReportProps {
  dimensions: DimensionResult[];
  /** Initially expanded dimensions */
  defaultExpanded?: AnalysisDimension[];
}

/** Color scheme per dimension for visual variety */
const dimensionColors: Record<AnalysisDimension, string> = {
  narrative_structure: "border-l-blue-500",
  character_design: "border-l-emerald-500",
  world_building: "border-l-amber-500",
  foreshadowing: "border-l-purple-500",
  pacing_tension: "border-l-red-500",
  shuanggan_mechanics: "border-l-orange-500",
  style_fingerprint: "border-l-teal-500",
  dialogue_voice: "border-l-pink-500",
  chapter_hooks: "border-l-indigo-500",
};

const dimensionIcons: Record<AnalysisDimension, string> = {
  narrative_structure: "📐",
  character_design: "👤",
  world_building: "🌍",
  foreshadowing: "🔮",
  pacing_tension: "⚡",
  shuanggan_mechanics: "🔥",
  style_fingerprint: "✒️",
  dialogue_voice: "💬",
  chapter_hooks: "🎣",
};

/**
 * §5.3.5 — Nine-dimension analysis report.
 * Expandable/collapsible cards for each dimension.
 */
export function DimensionReport({ dimensions, defaultExpanded }: DimensionReportProps) {
  const [expanded, setExpanded] = useState<Set<AnalysisDimension>>(() => {
    if (defaultExpanded) return new Set(defaultExpanded);
    const first = dimensions[0];
    return first ? new Set([first.dimension]) : new Set();
  });

  const toggleDimension = (dim: AnalysisDimension) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dim)) {
        next.delete(dim);
      } else {
        next.add(dim);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpanded(new Set(dimensions.map((d) => d.dimension)));
  };

  const collapseAll = () => {
    setExpanded(new Set());
  };

  if (dimensions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-muted-foreground">暂无维度分析数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Expand/collapse controls */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={expandAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          全部展开
        </button>
        <span className="text-xs text-muted-foreground">·</span>
        <button
          onClick={collapseAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          全部收起
        </button>
      </div>

      {/* Dimension cards */}
      {dimensions.map((dim) => {
        const isExpanded = expanded.has(dim.dimension);
        const colorClass = dimensionColors[dim.dimension];
        const icon = dimensionIcons[dim.dimension];

        return (
          <div
            key={dim.dimension}
            className={cn(
              "rounded-lg border border-border bg-card transition-all",
              "border-l-4",
              colorClass,
            )}
          >
            {/* Header — always visible */}
            <button
              onClick={() => toggleDimension(dim.dimension)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="text-lg">{icon}</span>
              <span className="font-medium text-sm">{dim.label}</span>
              <div className="ml-auto flex items-center gap-2">
                {dim.actionableInsights.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {dim.actionableInsights.length} 建议
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {dim.consumers.length} 消费方
                </Badge>
              </div>
            </button>

            {/* Content — expandable */}
            {isExpanded && (
              <div className="border-t border-border px-4 pb-4 pt-3">
                {/* Markdown-like content rendering */}
                <div className="prose prose-sm max-w-none text-foreground">
                  {renderMarkdownContent(dim.content)}
                </div>

                {/* Actionable insights */}
                {dim.actionableInsights.length > 0 && (
                  <div className="mt-4 rounded-md bg-amber-50 dark:bg-amber-950/20 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-200">
                      <Lightbulb className="h-4 w-4" />
                      可操作建议
                    </div>
                    <ul className="space-y-1">
                      {dim.actionableInsights.map((insight, i) => (
                        <li key={`insight-${dim.dimension}-${i}`} className="text-sm text-amber-700 dark:text-amber-300">
                          • {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Consumer agents */}
                <div className="mt-3 flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">消费方：</span>
                  {dim.consumers.map((c) => (
                    <Badge key={c} variant="outline" className="text-[10px]">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Simple markdown-to-JSX renderer for analysis content.
 * Handles: ## headings, ### subheadings, **bold**, - bullets, plain text.
 */
function renderMarkdownContent(content: string): React.ReactNode {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${key++}`} className="my-2 space-y-0.5 pl-1">
          {listItems.map((item, i) => (
            <li key={`li-${i}`} className="text-sm leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>,
      );
      listItems = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h4 key={`h4-${key++}`} className="mt-3 mb-1.5 text-sm font-semibold">
          {renderInline(trimmed.slice(4))}
        </h4>,
      );
    } else if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h3 key={`h3-${key++}`} className="mt-4 mb-2 text-base font-bold">
          {renderInline(trimmed.slice(3))}
        </h3>,
      );
    } else if (trimmed.startsWith("- ")) {
      listItems.push(trimmed.slice(2));
    } else {
      flushList();
      elements.push(
        <p key={`p-${key++}`} className="text-sm leading-relaxed">
          {renderInline(trimmed)}
        </p>,
      );
    }
  }

  flushList();
  return <>{elements}</>;
}

/** Render inline markdown (**bold**) */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={`bold-${i}`} className="font-semibold">{part}</strong>
    ) : (
      <span key={`text-${i}`}>{part}</span>
    ),
  );
}
