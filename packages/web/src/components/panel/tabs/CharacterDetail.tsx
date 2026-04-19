"use client";

import React from "react";
import { CollapsibleSection } from "@/components/panel/shared/CollapsibleSection";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";

interface CharacterDetailProps {
  character: any;
}

export function CharacterDetail({ character }: CharacterDetailProps) {
  return (
    <div className="p-4 space-y-6">
      <CollapsibleSection title="基础信息" defaultOpen>
        <div className="bg-background rounded-lg p-4 border border-border/50 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-semibold text-primary block mb-1 uppercase">叙事功能</span>
              <span className="font-medium text-foreground">{character.role}</span>
            </div>
            <div>
              <span className="text-xs font-semibold text-primary block mb-1 uppercase">设计深度</span>
              <span className="font-medium text-foreground">{character.designTier}</span>
            </div>
          </div>
          {character.biography && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <span className="text-xs font-semibold text-primary block mb-1 uppercase">人物传记</span>
              <div className="prose-sm prose-slate dark:prose-invert">
                <MarkdownRenderer content={character.biography} />
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="性格画像" defaultOpen>
        <div className="bg-background rounded-lg p-4 border border-border/50 text-sm prose-sm prose-slate dark:prose-invert">
          <MarkdownRenderer content={character.personality || "暂无数据"} />
        </div>
      </CollapsibleSection>

      {character.abilities && (
        <CollapsibleSection title="能力设定" defaultOpen>
          <div className="bg-background rounded-lg p-4 border border-border/50 text-sm prose-sm prose-slate dark:prose-invert">
            <MarkdownRenderer content={character.abilities} />
          </div>
        </CollapsibleSection>
      )}

      {/* 五维心理模型 (GHOST -> WOUND -> LIE -> WANT <-> NEED) */}
      <CollapsibleSection title="心理模型五维" defaultOpen>
        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[1.4rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-primary/20 before:to-transparent">
          
          <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-background bg-secondary text-primary font-bold shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
              GH
            </div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-4 rounded-xl border border-border/50 bg-background shadow-sm">
              <h4 className="font-bold text-foreground mb-1 text-sm uppercase tracking-wider">Ghost (创伤根源)</h4>
              <p className="text-xs text-muted-foreground">{character.ghost || "未设定"}</p>
            </div>
          </div>

          <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-background bg-secondary text-primary font-bold shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
              WO
            </div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-4 rounded-xl border border-border/50 bg-background shadow-sm">
              <h4 className="font-bold text-foreground mb-1 text-sm uppercase tracking-wider">Wound (心理伤痕)</h4>
              <p className="text-xs text-muted-foreground">{character.wound || "未设定"}</p>
            </div>
          </div>

          <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-background bg-secondary text-primary font-bold shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
              LI
            </div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-4 rounded-xl border border-border/50 bg-background shadow-sm">
              <h4 className="font-bold text-destructive mb-1 text-sm uppercase tracking-wider">Lie (核心谎言)</h4>
              <p className="text-xs text-muted-foreground">{character.lie || "未设定"}</p>
            </div>
          </div>

          <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-background bg-primary/20 text-primary font-bold shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
              ↔
            </div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border-2 border-primary/20 bg-primary/5 shadow-sm">
                <h4 className="font-bold text-primary mb-1 text-sm uppercase tracking-wider">Want (表面欲望)</h4>
                <p className="text-xs text-foreground/80">{character.want || "未设定"}</p>
              </div>
              <div className="p-4 rounded-xl border-2 border-emerald-500/20 bg-emerald-500/5 shadow-sm">
                <h4 className="font-bold text-emerald-600 mb-1 text-sm uppercase tracking-wider">Need (真实需求)</h4>
                <p className="text-xs text-foreground/80">{character.need || "未设定"}</p>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {character.arc && (
        <CollapsibleSection title="人物弧光" defaultOpen>
          <div className="bg-background rounded-lg p-4 border border-border/50 text-sm prose-sm prose-slate dark:prose-invert">
            <MarkdownRenderer content={character.arc} />
          </div>
        </CollapsibleSection>
      )}

      {character.relationships && character.relationships.length > 0 && (
        <CollapsibleSection title="关系网络" defaultOpen>
          <div className="bg-background rounded-lg border border-border/50 overflow-hidden text-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-secondary/50 border-b border-border/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2 font-medium">目标角色</th>
                  <th className="px-4 py-2 font-medium">关系类型</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {character.relationships.map((rel: any, idx: number) => (
                  <tr key={idx} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{rel.targetName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {rel.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {character.currentState && (
        <CollapsibleSection title="当前状态" defaultOpen>
          <div className="bg-gradient-to-br from-secondary/50 to-background rounded-xl p-5 border border-border/50 shadow-sm text-sm">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    📍 当前位置
                  </span>
                  <span className="font-medium text-foreground">{character.currentState.location || "未知"}</span>
                </div>
                <div>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    🧠 新获知识/能力
                  </span>
                  <span className="font-medium text-foreground">{character.currentState.newKnowledge || "无"}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    🎭 情绪状态
                  </span>
                  <span className="font-medium text-foreground">{character.currentState.emotion || "平静"}</span>
                </div>
                <div>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    💔 LIE 进度
                  </span>
                  <span className="font-medium text-foreground">{character.currentState.lieProgress || "稳固"}</span>
                </div>
              </div>
            </div>
            
            {character.currentState.relationshipChanges && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  🤝 关系变化摘要
                </span>
                <p className="text-foreground leading-relaxed">{character.currentState.relationshipChanges}</p>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
