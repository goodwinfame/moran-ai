"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { usePanelStore } from "@/stores/panel-store";
import { TabEmptyState } from "../shared/TabEmptyState";
import { CollapsibleSection } from "../shared/CollapsibleSection";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { cn } from "@/lib/utils";
import type { AnalysisData, ExternalReport } from "@/stores/panel-store-types";

const AnalysisChartsInner = dynamic(
  () => import("./AnalysisChartsInner").then((mod) => mod.AnalysisChartsInner),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] border rounded-lg animate-pulse bg-secondary flex items-center justify-center text-muted-foreground text-sm">
        加载图表...
      </div>
    ),
  }
);

type AnalysisView = "internal" | "external";

export interface TabProps {
  projectId: string;
}

export default function AnalysisTab(_props: TabProps) {
  const analysis = usePanelStore((s) => s.analysis);
  const externalAnalysis = usePanelStore((s) => s.externalAnalysis);
  const [view, setView] = useState<AnalysisView>("internal");
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const hasInternal = !!analysis;
  const hasExternal = !!externalAnalysis && externalAnalysis.reports.length > 0;

  if (!hasInternal && !hasExternal) {
    return <TabEmptyState text="分析数据尚未就绪。完成若干章节审校后..." icon="📊" />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* View Toggle */}
      <div className="flex gap-4 px-4 py-2 border-b text-sm">
        <button
          onClick={() => setView("internal")}
          className={cn(
            "pb-2 -mb-[9px] transition-colors",
            view === "internal"
              ? "font-medium text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          本项目分析
        </button>
        <button
          onClick={() => setView("external")}
          className={cn(
            "pb-2 -mb-[9px] transition-colors",
            view === "external"
              ? "font-medium text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          参考作品
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {view === "internal" && (
          <InternalAnalysisView
            analysis={analysis}
            chartsComponent={<AnalysisChartsInner analysis={analysis} />}
          />
        )}
        {view === "external" && (
          <ExternalAnalysisView
            reports={externalAnalysis?.reports ?? []}
            expandedId={expandedReportId}
            onToggle={(id) => setExpandedReportId(expandedReportId === id ? null : id)}
          />
        )}
      </div>
    </div>
  );
}

function InternalAnalysisView({
  analysis,
  chartsComponent,
}: {
  analysis: AnalysisData | null;
  chartsComponent: React.ReactNode;
}) {
  if (!analysis) {
    return (
      <div className="text-center text-muted-foreground p-8">
        项目分析数据尚未生成
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="border rounded-xl p-5 bg-card shadow-sm text-center">
        <div className="text-4xl font-black text-primary mb-1">{analysis.overallScore}</div>
        <p className="text-sm text-muted-foreground">综合评分</p>
      </div>

      {/* Charts (Recharts — dynamically loaded) */}
      {chartsComponent}

      {/* Commentary */}
      {analysis.commentary && (
        <CollapsibleSection title="析典评语" defaultOpen>
          <div className="bg-secondary/20 rounded-xl p-5 border border-border/50 shadow-inner prose-sm max-w-none">
            <MarkdownRenderer content={analysis.commentary} />
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

function ExternalAnalysisView({
  reports,
  expandedId,
  onToggle,
}: {
  reports: ExternalReport[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  if (reports.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-8">
        暂无参考作品分析报告
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map((report) => {
        const isExpanded = expandedId === report.id;
        return (
          <div key={report.id} className="border rounded-xl bg-card shadow-sm overflow-hidden">
            <button
              onClick={() => onToggle(report.id)}
              className="w-full text-left p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-base">{report.workTitle}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{report.topic}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 mt-1">{report.date}</span>
              </div>
            </button>
            {isExpanded && (
              <div className="border-t p-5 bg-secondary/10 prose-sm max-w-none">
                <MarkdownRenderer content={report.content} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
