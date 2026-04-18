"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AlignmentLayout } from "@/components/alignment/alignment-layout";
import { ChatPanel } from "@/components/alignment/chat-panel";
import { MessageBubble } from "@/components/alignment/message-bubble";
import { ResultPanel } from "@/components/alignment/result-panel";
import { usePreparationStore } from "@/stores/preparation-store";

// 与 core/src/jiangxin/types.ts 保持同步
interface ExplosionPoint {
  chapterIndex: number;
  description: string;
  type: string;
}

interface ChapterOutline {
  index: number;
  description: string;
  chapterType: "daily" | "normal" | "emotional" | "action" | "explosion";
  isExplosion: boolean;
}

interface ArcPlan {
  arcNumber: number;
  name: string;
  goal: string;
  chapterCount: number;
  explosionPoints: ExplosionPoint[];
  chapterOutlines: ChapterOutline[];
  characterArcs: Array<{
    characterId: string;
    characterName: string;
    arcProgress: string;
  }>;
}

const CHAPTER_TYPE_LABELS: Record<string, string> = {
  daily: "日常",
  normal: "正常",
  emotional: "情感",
  action: "动作",
  explosion: "爆点",
};

const WELCOME_MESSAGE =
  "你好！我是匠心，负责帮你规划故事结构。请描述你对大纲的想法——比如故事的核心冲突、想要的节奏、关键情节等。我会结合世界观和角色来设计弧段计划。";

export default function OutlinePage() {
  const params = useParams();
  const projectId = (params?.id as string) ?? "unknown";

  const { messages, isLoading, addMessage, setLoading, reset } =
    usePreparationStore();

  const [arcPlan, setArcPlan] = useState<ArcPlan | null>(null);
  const [worldOverview, setWorldOverview] = useState("");
  const [charactersSummary, setCharactersSummary] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 初始化：加载世界观 + 角色概要作为上下文
  useEffect(() => {
    reset();
    addMessage({
      id: "welcome",
      role: "assistant",
      content: WELCOME_MESSAGE,
      timestamp: Date.now(),
    });

    // 并行加载世界观 + 角色
    Promise.all([
      fetch(`/api/projects/${projectId}/world`)
        .then((r) => r.json())
        .catch(() => ({ settings: [] })),
      fetch(`/api/projects/${projectId}/characters`)
        .then((r) => r.json())
        .catch(() => ({ characters: [] })),
    ]).then(
      ([worldData, charData]: [
        { settings?: Array<{ content: string }> },
        { characters?: Array<{ name: string; role: string; description: string }> },
      ]) => {
        if (worldData.settings && worldData.settings.length > 0) {
          setWorldOverview(worldData.settings.map((s) => s.content).join("\n"));
        }
        if (charData.characters && charData.characters.length > 0) {
          setCharactersSummary(
            charData.characters
              .map((c) => `${c.name}(${c.role}): ${c.description}`)
              .join("\n")
          );
        }
      }
    );
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(
    async (text: string) => {
      addMessage({
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: Date.now(),
      });
      setLoading(true);

      try {
        const res = await fetch(
          `/api/projects/${projectId}/outline/align`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              briefSummary: text,
              worldOverview: worldOverview || "尚未设定世界观",
              charactersSummary: charactersSummary || "尚未设定角色",
              arcNumber: 1,
            }),
          }
        );

        const json = (await res.json()) as {
          reply?: string;
          data?: { arcPlan: ArcPlan };
          error?: string;
        };

        if (!res.ok) {
          addMessage({
            id: `err-${Date.now()}`,
            role: "assistant",
            content: `出了点问题：${json.error ?? "未知错误"}，请重试。`,
            timestamp: Date.now(),
          });
          return;
        }

        if (json.reply) {
          addMessage({
            id: `a-${Date.now()}`,
            role: "assistant",
            content: json.reply,
            timestamp: Date.now(),
          });
        }

        if (json.data?.arcPlan) {
          setArcPlan(json.data.arcPlan);
        }
      } catch {
        addMessage({
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "网络出了点问题，请稍后重试。",
          timestamp: Date.now(),
        });
      } finally {
        setLoading(false);
      }
    },
    [projectId, worldOverview, charactersSummary, addMessage, setLoading]
  );

  return (
    <AlignmentLayout
      chat={
        <ChatPanel
          title="大纲对齐"
          subtitle="规划故事走向与节奏"
          onSend={handleSend}
          isLoading={isLoading}
          inputPlaceholder="描述你对大纲的想法..."
        >
          {messages.map((msg) => (
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
          ))}
          {isLoading && (
            <MessageBubble role="assistant" content="匠心正在规划结构..." />
          )}
          <div ref={messagesEndRef} />
        </ChatPanel>
      }
      result={
        <ResultPanel
          title="大纲文档"
          ctaText={arcPlan ? "确认大纲并继续" : undefined}
        >
          {arcPlan ? (
            <div className="space-y-6">
              {/* 弧段信息 */}
              <div>
                <div className="border-l-4 border-[#1A202C] pl-4 py-1 mb-4">
                  <h4 className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">
                    弧段 {arcPlan.arcNumber}：{arcPlan.name}
                  </h4>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <h5 className="text-sm font-bold text-[#1A202C] mb-2">
                    核心目标
                  </h5>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {arcPlan.goal}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    共 {arcPlan.chapterCount} 章
                  </p>
                </div>
              </div>

              {/* 爆点设计 */}
              {arcPlan.explosionPoints.length > 0 && (
                <div>
                  <div className="border-l-4 border-amber-500 pl-4 py-1 mb-4">
                    <h4 className="text-[10px] text-amber-600 uppercase tracking-[0.2em]">
                      爆点设计 ({arcPlan.explosionPoints.length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {arcPlan.explosionPoints.map((ep, i) => (
                      <div
                        key={i}
                        className="bg-amber-50 border border-amber-100 rounded-lg p-3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-amber-700">
                            第 {ep.chapterIndex} 章
                          </span>
                          <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">
                            {ep.type}
                          </span>
                        </div>
                        <p className="text-xs text-amber-900">
                          {ep.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 章节时间线 */}
              {arcPlan.chapterOutlines.length > 0 && (
                <div>
                  <div className="border-l-4 border-[#1A202C] pl-4 py-1 mb-4">
                    <h4 className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">
                      章节时间线
                    </h4>
                  </div>
                  <div className="space-y-4 pl-2 border-l border-slate-200 ml-4">
                    {arcPlan.chapterOutlines.map((ch) => (
                      <div key={ch.index} className="relative pl-6">
                        <span
                          className={`absolute -left-[5px] top-1.5 size-2 rounded-full ${
                            ch.isExplosion ? "bg-amber-500" : "bg-slate-300"
                          }`}
                        />
                        <div className="flex items-center gap-2">
                          <h6 className="text-sm font-bold text-slate-800">
                            第 {ch.index} 章
                          </h6>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${
                              ch.isExplosion
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {CHAPTER_TYPE_LABELS[ch.chapterType] ??
                              ch.chapterType}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {ch.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 角色发展 */}
              {arcPlan.characterArcs.length > 0 && (
                <div>
                  <div className="border-l-4 border-[#1A202C] pl-4 py-1 mb-4">
                    <h4 className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">
                      角色发展
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {arcPlan.characterArcs.map((ca) => (
                      <div
                        key={ca.characterId}
                        className="flex justify-between items-start text-sm"
                      >
                        <span className="text-slate-800 font-medium shrink-0">
                          {ca.characterName}
                        </span>
                        <span className="text-slate-600 text-right max-w-[65%] text-xs">
                          {ca.arcProgress}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 space-y-3">
              <span className="text-3xl">✦</span>
              <p className="text-sm leading-relaxed">
                描述你对大纲的想法
                <br />
                AI 将为你规划完整的弧段计划
              </p>
            </div>
          )}
        </ResultPanel>
      }
    />
  );
}
