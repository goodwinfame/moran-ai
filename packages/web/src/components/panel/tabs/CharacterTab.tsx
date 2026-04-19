"use client";

import React, { useState } from "react";
import { usePanelStore } from "@/stores/panel-store";
import { CollapsibleSection } from "@/components/panel/shared/CollapsibleSection";
import { TabEmptyState } from "@/components/panel/shared/TabEmptyState";
import { CharacterDetail } from "./CharacterDetail";
import { RelationshipGraph } from "./RelationshipGraph";
import { cn } from "@/lib/utils";

interface TabProps {
  projectId: string;
}

const DESIGN_TIERS = ["核心层", "重要层", "支撑层", "点缀层"] as const;

const ROLE_OPTIONS = [
  { value: null, label: "全部" },
  { value: "protagonist", label: "主角" },
  { value: "deuteragonist", label: "第二主角" },
  { value: "antagonist", label: "对手" },
  { value: "supporting", label: "配角" },
  { value: "minor", label: "次要" },
] as const;

export function CharacterTab(_props: TabProps) {
  const data = usePanelStore((s) => s.characters);
  const [filterRole, setFilterRole] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  if (!data || !data.characters || data.characters.length === 0) {
    return <TabEmptyState text="角色档案尚未创建。世界观设定完成后..." />;
  }

  const filtered = filterRole
    ? data.characters.filter((c) => c.role === filterRole)
    : data.characters;

  const grouped = DESIGN_TIERS.map((tier) => ({
    tier,
    characters: filtered.filter((c) => c.designTier === tier),
  })).filter((g) => g.characters.length > 0);

  const graphCharacters = filtered.filter(
    (c) => c.designTier === "核心层" || c.designTier === "重要层"
  );

  return (
    <div className="p-4 space-y-6">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur -mx-4 px-4 py-2 -mt-4 border-b">
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setFilterRole(opt.value)}
              className={cn(
                "px-3 py-1 text-xs rounded-full border transition-all duration-200",
                filterRole === opt.value
                  ? "bg-primary text-primary-foreground border-primary font-medium"
                  : "bg-background text-muted-foreground hover:bg-secondary"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {grouped.map(({ tier, characters }) => (
        <CollapsibleSection
          key={tier}
          title={tier}
          defaultOpen={tier === "核心层" || tier === "重要层"}
          badge={`${characters.length} 个角色`}
        >
          {tier === "点缀层" ? (
            <div className="bg-secondary/20 rounded-lg p-3 border border-border/50">
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {characters.map((c) => (
                  <li key={c.id} className="text-sm flex items-center gap-2 truncate">
                    <span className="text-lg bg-background rounded-md w-8 h-8 flex items-center justify-center border shadow-sm flex-shrink-0">
                      👤
                    </span>
                    <div className="truncate">
                      <span className="font-medium text-foreground mr-2">{c.name}</span>
                      {c.biography && <span className="text-muted-foreground text-xs truncate">{c.biography}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="grid gap-4">
              {characters.map((c) => (
                <div key={c.id} className="bg-card border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="p-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-secondary rounded-xl border border-border/50 flex items-center justify-center text-3xl shadow-inner">
                          👤
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg text-foreground">{c.name}</h3>
                            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-md text-[10px] font-bold uppercase tracking-wider">
                              {ROLE_OPTIONS.find((r) => r.value === c.role)?.label || c.role}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">{c.personality}</p>
                        </div>
                      </div>
                      
                      {tier === "核心层" && (
                        <button
                          onClick={() => setExpandedCardId(expandedCardId === c.id ? null : c.id)}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors",
                            expandedCardId === c.id
                              ? "bg-secondary border-transparent text-foreground"
                              : "bg-background border-border text-primary hover:bg-secondary/50"
                          )}
                        >
                          {expandedCardId === c.id ? "收起详情" : "查看详情"}
                        </button>
                      )}
                    </div>
                    
                    {(tier === "重要层" || tier === "支撑层") && (
                      <div className="mt-4 pt-3 border-t border-border/50 grid sm:grid-cols-2 gap-4 text-sm">
                        {c.want && (
                          <div>
                            <span className="text-xs font-semibold text-primary block mb-1">主要目标</span>
                            <span className="text-muted-foreground line-clamp-1">{c.want}</span>
                          </div>
                        )}
                        {c.relationships && (
                          <div>
                            <span className="text-xs font-semibold text-primary block mb-1">核心关系</span>
                            <span className="text-muted-foreground line-clamp-1">
                              {c.relationships}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {tier === "核心层" && expandedCardId === c.id && (
                    <div className="border-t border-border/50 bg-secondary/10 p-1">
                      <CharacterDetail character={c} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>
      ))}

      {graphCharacters.length > 0 && (
        <CollapsibleSection title="角色关系网络" defaultOpen>
          <RelationshipGraph characters={graphCharacters} />
        </CollapsibleSection>
      )}
    </div>
  );
}
