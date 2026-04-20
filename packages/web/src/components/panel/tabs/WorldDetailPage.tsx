"use client";

import React, { useMemo, useEffect } from "react";
import { usePanelStore } from "@/stores/panel-store";
import { CollapsibleSection } from "@/components/panel/shared/CollapsibleSection";

interface WorldDetailPageProps {
  projectId: string;
  subsystemId: string;
  onBack: () => void;
  onNavigate: (id: string) => void;
}

export function WorldDetailPage({ projectId, subsystemId, onBack }: WorldDetailPageProps) {
  const worldData = usePanelStore((s) => s.world);
  const worldDetail = usePanelStore((s) => s.worldDetail);
  const subsystem = useMemo(
    () => worldData?.subsystems.find((sub) => sub.id === subsystemId),
    [worldData, subsystemId]
  );

  useEffect(() => {
    void usePanelStore.getState().fetchWorldDetail(projectId, subsystemId);
    return () => {
      usePanelStore.getState().clearWorldDetail();
    };
  }, [projectId, subsystemId]);

  if (!subsystem) {
    return <div className="p-4 text-center text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 bg-secondary/20 p-2 rounded-lg">
        <button
          onClick={onBack}
          className="hover:text-primary transition-colors flex items-center gap-1 font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回设定总览
        </button>
        <span className="text-border">›</span>
        <span className="text-foreground flex items-center gap-1.5 font-semibold">
          <span>{subsystem.icon}</span> {subsystem.name}
        </span>
      </nav>

      <div className="mb-6 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="text-4xl bg-primary/10 p-3 rounded-2xl shadow-sm">{subsystem.icon}</div>
          <div>
            <h2 className="text-2xl font-black text-foreground tracking-tight">{subsystem.name}</h2>
            <p className="text-sm font-medium text-muted-foreground mt-1 flex items-center gap-2">
              <span className="px-2 py-0.5 bg-secondary rounded-md text-xs">{subsystem.category}</span>
              {subsystem.lastUpdatedChapter && (
                <span>最后更新：第 <span className="text-foreground font-bold">{subsystem.lastUpdatedChapter}</span> 章后</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <CollapsibleSection title="设定概要" badge={`${subsystem.entryCount} 条目`} defaultOpen>
          <div className="bg-secondary/20 rounded-xl p-5 border border-border/50 shadow-inner text-sm text-foreground/90 leading-relaxed">
            {subsystem.summary || "暂无详细设定内容"}
          </div>
        </CollapsibleSection>

        {worldDetail ? (
          <CollapsibleSection title="详细内容" defaultOpen>
            <div className="bg-secondary/20 rounded-xl p-5 border border-border/50 shadow-inner text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {worldDetail.content}
            </div>
          </CollapsibleSection>
        ) : (
          <div className="text-sm text-muted-foreground animate-pulse">加载详细内容中...</div>
        )}
      </div>
    </div>
  );
}
