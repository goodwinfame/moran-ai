"use client";

import React from "react";
import { usePanelStore } from "@/stores/panel-store";
import { useChatStore } from "@/stores/chat-store";
import { CollapsibleSection } from "@/components/panel/shared/CollapsibleSection";
import { TabEmptyState } from "@/components/panel/shared/TabEmptyState";
import { Icon } from "@/components/ui/icon";

interface TabProps {
  projectId: string;
}

export function BrainstormTab({ projectId }: TabProps) {
  const data = usePanelStore((s) => s.brainstorm);

  if (!data) {
    return <TabEmptyState text="还没有脑暴记录。在左侧告诉墨衡你的创作灵感..." />;
  }

  const handleStar = (direction: string) => {
    useChatStore.getState().sendMessage(projectId, `我喜欢方向：${direction}`);
  };

  return (
    <div className="p-4 space-y-4">
      <CollapsibleSection title="发散阶段" defaultOpen>
        <div className="space-y-2">
          {data.diverge.map((d) => (
            <div
              key={d.id}
              className="flex items-start justify-between py-2 px-3 rounded-md hover:bg-secondary/50 transition-colors group"
            >
              <div className="flex flex-col gap-1 pr-4">
                <span className="text-sm font-medium text-foreground">{d.title}</span>
              </div>
              <button
                onClick={() => handleStar(d.title)}
                className="flex-shrink-0 mt-0.5 text-muted-foreground hover:text-amber-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                aria-label={`⭐ 喜欢方向 ${d.title}`}
                title="选择此方向"
              >
                <Icon name="star" size={16} filled={d.starred} className={d.starred ? "text-amber-400" : ""} />
              </button>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {data.converge && (
        <CollapsibleSection title="聚焦阶段" defaultOpen>
          <div className="bg-secondary/30 rounded-lg p-4 space-y-3 border border-border/50 text-sm">
            {data.converge.selectedDirections.length > 0 && (
              <div>
                <span className="text-muted-foreground block mb-1">入选方向：</span>
                <div className="flex flex-wrap gap-2">
                  {data.converge.selectedDirections.map((dir, i) => (
                    <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary rounded-md text-xs font-medium">
                      {dir}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
              <div>
                <span className="text-muted-foreground block text-xs mb-1">题材</span>
                <span className="font-medium text-foreground">{data.converge.genre}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs mb-1">目标读者</span>
                <span className="font-medium text-foreground">{data.converge.targetAudience}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-border/50">
              <span className="text-muted-foreground block text-xs mb-1">核心冲突</span>
              <p className="text-foreground leading-relaxed">{data.converge.coreConflict}</p>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {data.crystal && (
        <CollapsibleSection title="✨ 结晶方案" defaultOpen>
          <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-md">
                {data.crystal.type}
              </span>
              <h3 className="text-lg font-bold text-foreground line-clamp-1">{data.crystal.title}</h3>
            </div>
            
            <div className="space-y-4 text-sm">
              <div>
                <span className="text-xs font-semibold text-primary uppercase tracking-wider block mb-1">一句话梗概</span>
                <p className="text-foreground font-medium italic border-l-2 border-primary/40 pl-3 py-1">
                  "{data.crystal.oneLiner}"
                </p>
              </div>

              <div>
                <span className="text-xs font-semibold text-primary uppercase tracking-wider block mb-1">核心概念</span>
                <p className="text-foreground leading-relaxed">{data.crystal.concept}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-background/60 p-3 rounded-lg border border-border/50">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider block mb-1">核心卖点</span>
                  <p className="text-foreground leading-relaxed">{data.crystal.sellingPoints}</p>
                </div>
                <div className="bg-background/60 p-3 rounded-lg border border-border/50">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider block mb-1">篇幅预期</span>
                  <p className="text-foreground leading-relaxed">{data.crystal.wordTarget}</p>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
