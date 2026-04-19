"use client";

import { useState } from "react";
import { usePanelStore } from "@/stores/panel-store";
import { cn } from "@/lib/utils";
import { ForeshadowView } from "./ForeshadowView";
import { TimelineView } from "./TimelineView";
import { CollapsibleSection } from "../shared/CollapsibleSection";
import { TabEmptyState } from "../shared/TabEmptyState";
import { Icon } from "@/components/ui/icon";

type OutlineView = "outline" | "foreshadow" | "timeline";

const STATUS_ICONS: Record<string, string> = {
  completed: "✅",
  writing: "📝",
  reviewing: "🔄",
  pending: "⏳",
  unplanned: "📋",
};

export function OutlineTab() {
  const [view, setView] = useState<OutlineView>("outline");
  const outline = usePanelStore((s) => s.outline);
  const foreshadows = usePanelStore((s) => s.foreshadows);
  const timeline = usePanelStore((s) => s.timeline);

  if (!outline && !foreshadows && !timeline) {
    return <TabEmptyState text="故事大纲尚未创建。角色设定完成后..." icon="📝" />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-4 px-4 py-2 border-b text-sm">
        <button
          onClick={() => setView("outline")}
          className={cn(
            "pb-2 -mb-[9px] transition-colors",
            view === "outline" ? "font-medium text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          大纲
        </button>
        <button
          onClick={() => setView("foreshadow")}
          className={cn(
            "pb-2 -mb-[9px] transition-colors",
            view === "foreshadow" ? "font-medium text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          伏笔追踪
        </button>
        <button
          onClick={() => setView("timeline")}
          className={cn(
            "pb-2 -mb-[9px] transition-colors",
            view === "timeline" ? "font-medium text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          时间线
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {view === "outline" && outline && <OutlineInnerView outline={outline} />}
        {view === "foreshadow" && foreshadows && <ForeshadowView data={foreshadows} />}
        {view === "timeline" && timeline && <TimelineView data={timeline} />}
      </div>
    </div>
  );
}

function OutlineInnerView({ outline }: { outline: any }) {
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {outline.arcs?.map((arc: any) => (
        <CollapsibleSection key={arc.id} title={arc.title} badge={arc.chapterRange} defaultOpen>
          <div className="space-y-2 pl-2">
            {arc.chapters?.map((ch: any) => {
              const isExpanded = expandedChapter === `${arc.id}-${ch.number}`;
              return (
                <div key={ch.number} className="border rounded-md bg-card">
                  <div
                    className="flex items-center gap-2 p-3 cursor-pointer hover:bg-accent/50"
                    onClick={() => setExpandedChapter(isExpanded ? null : `${arc.id}-${ch.number}`)}
                  >
                    <span className="text-sm">{STATUS_ICONS[ch.status] || "📋"}</span>
                    <span className="font-medium text-sm">
                      第 {ch.number} 章：{ch.title}
                    </span>
                    <div className="ml-auto">
                      <Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={16} />
                    </div>
                  </div>
                  
                  {isExpanded && ch.brief && (
                    <div className="p-3 pt-0 border-t mt-2 text-sm space-y-3 bg-muted/20">
                      <div>
                        <h4 className="font-medium text-xs text-muted-foreground mb-1">剧情摘要</h4>
                        <p>{ch.brief.plotSummary}</p>
                      </div>
                      
                      {ch.brief.coreEvents?.length > 0 && (
                        <div>
                          <h4 className="font-medium text-xs text-muted-foreground mb-1">核心事件</h4>
                          <ul className="list-disc pl-4 space-y-1">
                            {ch.brief.coreEvents.map((e: string, i: number) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {ch.brief.foreshadowPoints?.length > 0 && (
                        <div>
                          <h4 className="font-medium text-xs text-muted-foreground mb-1">伏笔/爆点</h4>
                          <ul className="list-disc pl-4 space-y-1">
                            {ch.brief.foreshadowPoints.map((e: string, i: number) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <div className="flex gap-4 pt-2 text-xs text-muted-foreground">
                        {ch.brief.involvedCharacters?.length > 0 && (
                          <div>
                            <span className="font-medium">角色：</span> 
                            {ch.brief.involvedCharacters.join(", ")}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">字数目标：</span> 
                          {ch.brief.wordTarget} 字
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      ))}
    </div>
  );
}
