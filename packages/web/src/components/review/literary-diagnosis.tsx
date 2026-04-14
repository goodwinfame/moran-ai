"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Stethoscope, AlertTriangle, ChevronDown, ChevronRight, Target } from "lucide-react";

// ── Types ──────────────────────────────────────────

export type DiagnosisDimension =
  | "narrative_drive"
  | "emotional_authenticity"
  | "pacing_root_cause"
  | "character_voice"
  | "thematic_coherence";

export interface DimensionDiagnosisData {
  dimension: DiagnosisDimension;
  label: string;
  severity: number;
  rootCause: string;
  improvementDirection: string;
  evidence?: string;
}

export interface CoreIssueData {
  title: string;
  dimensions: DiagnosisDimension[];
  rootCause: string;
  improvementDirection: string;
  impact: number;
}

export interface LiteraryDiagnosisData {
  chapterNumber: number;
  dimensionDiagnoses: DimensionDiagnosisData[];
  coreIssues: CoreIssueData[];
  summary: string;
}

interface LiteraryDiagnosisProps {
  data: LiteraryDiagnosisData;
}

// ── Helpers ────────────────────────────────────────

const dimensionColors: Record<DiagnosisDimension, string> = {
  narrative_drive: "border-l-blue-500",
  emotional_authenticity: "border-l-rose-500",
  pacing_root_cause: "border-l-amber-500",
  character_voice: "border-l-teal-500",
  thematic_coherence: "border-l-purple-500",
};

const dimensionIcons: Record<DiagnosisDimension, string> = {
  narrative_drive: "\u26A1",
  emotional_authenticity: "\u2764\uFE0F",
  pacing_root_cause: "\u23F1\uFE0F",
  character_voice: "\uD83D\uDDE3\uFE0F",
  thematic_coherence: "\uD83C\uDFAF",
};

function severityColor(severity: number): string {
  if (severity >= 7) return "text-red-600 border-red-300 bg-red-50 dark:bg-red-950/20";
  if (severity >= 4) return "text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20";
  return "text-green-600 border-green-300 bg-green-50 dark:bg-green-950/20";
}

function severityLabel(severity: number): string {
  if (severity >= 7) return "\u4E25\u91CD";
  if (severity >= 4) return "\u4E2D\u7B49";
  return "\u8F7B\u5FAE";
}

function impactBadge(impact: number): string {
  if (impact >= 7) return "destructive";
  if (impact >= 4) return "secondary";
  return "outline";
}

// ── Component ──────────────────────────────────────

/**
 * 点睛文学诊断报告 — 深度诊断"为什么不好"而非"哪里不好"
 */
export function LiteraryDiagnosis({ data }: LiteraryDiagnosisProps) {
  const { chapterNumber, dimensionDiagnoses, coreIssues, summary } = data;
  const [expanded, setExpanded] = useState<Set<DiagnosisDimension>>(() => {
    // Auto-expand the most severe dimension
    const sorted = [...dimensionDiagnoses].sort((a, b) => b.severity - a.severity);
    const worst = sorted[0];
    return worst ? new Set([worst.dimension]) : new Set();
  });

  const toggle = (dim: DiagnosisDimension) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dim)) next.delete(dim);
      else next.add(dim);
      return next;
    });
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Stethoscope className="h-4 w-4 text-indigo-500" />
        <h3 className="text-base font-semibold">
          第{chapterNumber}章 · 文学诊断
        </h3>
      </div>

      {/* Summary */}
      <div className="rounded-lg bg-muted/50 p-3">
        <p className="text-sm leading-relaxed">{summary}</p>
      </div>

      <Separator />

      {/* Core issues (prioritized, max 1-2) */}
      {coreIssues.length > 0 && (
        <div>
          <h4 className="mb-3 flex items-center gap-1.5 text-sm font-medium">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            核心问题 ({coreIssues.length})
          </h4>
          <div className="space-y-3">
            {coreIssues.map((issue, i) => (
              <div key={`core-${i}`} className="rounded-lg border border-red-200 dark:border-red-900/30 p-4">
                <div className="flex items-start justify-between mb-2">
                  <h5 className="text-sm font-semibold text-red-700 dark:text-red-300">{issue.title}</h5>
                  <Badge variant={impactBadge(issue.impact) as "destructive" | "secondary" | "outline"} className="text-[10px] ml-2 shrink-0">
                    影响 {issue.impact}/10
                  </Badge>
                </div>
                <div className="mb-2 flex flex-wrap gap-1">
                  {issue.dimensions.map((dim) => (
                    <Badge key={dim} variant="outline" className="text-[10px]">
                      {dimensionIcons[dim]} {dimensionDiagnoses.find((d) => d.dimension === dim)?.label ?? dim}
                    </Badge>
                  ))}
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">根因</p>
                    <p className="text-sm">{issue.rootCause}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">改进方向</p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">{issue.improvementDirection}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Five-dimension diagnoses */}
      <div>
        <h4 className="mb-3 flex items-center gap-1.5 text-sm font-medium">
          <Target className="h-3.5 w-3.5 text-indigo-500" />
          五维诊断
        </h4>
        <div className="space-y-2">
          {dimensionDiagnoses.map((dim) => {
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
                {/* Collapsible header */}
                <button
                  onClick={() => toggle(dim.dimension)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="text-base">{icon}</span>
                  <span className="text-sm font-medium">{dim.label}</span>
                  <Badge
                    variant="outline"
                    className={cn("ml-auto text-[10px]", severityColor(dim.severity))}
                  >
                    {severityLabel(dim.severity)} ({dim.severity}/10)
                  </Badge>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">根因分析</p>
                      <p className="text-sm leading-relaxed">{dim.rootCause}</p>
                    </div>
                    {dim.evidence && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">证据</p>
                        <blockquote className="text-sm border-l-2 border-muted-foreground/30 pl-2 italic text-muted-foreground">
                          {dim.evidence}
                        </blockquote>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">改进方向</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">{dim.improvementDirection}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
