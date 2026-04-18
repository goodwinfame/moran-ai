"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AlignmentLayout } from "@/components/alignment/alignment-layout";
import { ChatPanel } from "@/components/alignment/chat-panel";
import { MessageBubble } from "@/components/alignment/message-bubble";
import { ResultPanel } from "@/components/alignment/result-panel";
import { Icon } from "@/components/ui/icon";
import { usePreparationStore } from "@/stores/preparation-store";

// 与 core/src/jiangxin/types.ts 的 WorldSubsystem 保持同步
interface WorldSubsystem {
  id: string;
  name: string;
  tags: string[];
  description: string;
  rules: string[];
}

interface WorldData {
  overview: string;
  subsystems: WorldSubsystem[];
}

const WELCOME_MESSAGE =
  "你好！我是匠心，负责帮你构建故事世界。请描述你的世界设定想法——可以是一个时代背景、一种力量体系，或者一段简短的设定梗概。";

export default function WorldPage() {
  const params = useParams();
  const projectId = (params?.id as string) ?? "unknown";

  const { messages, isLoading, addMessage, setLoading, reset } =
    usePreparationStore();

  const [worldData, setWorldData] = useState<WorldData | null>(null);
  const [expandedSystems, setExpandedSystems] = useState<Set<string>>(
    new Set()
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 初始化
  useEffect(() => {
    reset();
    addMessage({
      id: "welcome",
      role: "assistant",
      content: WELCOME_MESSAGE,
      timestamp: Date.now(),
    });
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 自动滚到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleSystem = useCallback((id: string) => {
    setExpandedSystems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
          `/api/projects/${projectId}/world/align`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ briefSummary: text }),
          }
        );

        const json = (await res.json()) as {
          reply?: string;
          data?: WorldData;
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

        if (json.data) {
          setWorldData(json.data);
          const firstSub = json.data.subsystems[0];
          if (firstSub) {
            setExpandedSystems(new Set([firstSub.id]));
          }
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
    [projectId, addMessage, setLoading]
  );

  return (
    <AlignmentLayout
      chat={
        <ChatPanel
          title="世界观对齐"
          subtitle="AI 匠心正在帮你构建故事世界"
          onSend={handleSend}
          isLoading={isLoading}
          inputPlaceholder="描述你的世界设定想法..."
        >
          {messages.map((msg) => (
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
          ))}
          {isLoading && (
            <MessageBubble role="assistant" content="匠心正在构建世界..." />
          )}
          <div ref={messagesEndRef} />
        </ChatPanel>
      }
      result={
        <ResultPanel
          title="世界观文档"
          ctaText={worldData ? "确认世界观并继续" : undefined}
        >
          {worldData ? (
            <div className="space-y-6">
              {/* 世界概述 */}
              <div>
                <div className="border-l-4 border-[#1A202C] pl-4 py-1 mb-4">
                  <h4 className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">
                    世界概述
                  </h4>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {worldData.overview}
                </p>
              </div>

              {/* 子系统 */}
              <div>
                <div className="border-l-4 border-[#1A202C] pl-4 py-1 mb-4">
                  <h4 className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">
                    子系统
                  </h4>
                </div>
                <div className="space-y-3">
                  {worldData.subsystems.map((sys) => {
                    const isExpanded = expandedSystems.has(sys.id);
                    return (
                      <div
                        key={sys.id}
                        className={
                          isExpanded
                            ? "bg-slate-50 rounded-lg p-3"
                            : "border border-slate-100 rounded-lg"
                        }
                      >
                        <button
                          onClick={() => toggleSystem(sys.id)}
                          className={`flex items-center gap-2 text-sm font-bold w-full text-left ${
                            isExpanded
                              ? "text-slate-800 mb-3"
                              : "text-slate-800 p-3"
                          }`}
                        >
                          <Icon
                            name={
                              isExpanded ? "arrow_drop_down" : "arrow_right"
                            }
                            size={18}
                            className={isExpanded ? "" : "text-slate-400"}
                          />
                          <span>{sys.name}</span>
                          {sys.tags.length > 0 && (
                            <span className="ml-auto flex gap-1">
                              {sys.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </span>
                          )}
                        </button>
                        {isExpanded && (
                          <div className="pl-6 space-y-2 border-l border-slate-200 ml-2">
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {sys.description}
                            </p>
                            {sys.rules.length > 0 && (
                              <div className="space-y-1 mt-2">
                                {sys.rules.map((rule, i) => (
                                  <div
                                    key={i}
                                    className="flex items-start gap-2 text-xs text-slate-600"
                                  >
                                    <span className="size-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                                    <span>{rule}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 space-y-3">
              <span className="text-3xl">✦</span>
              <p className="text-sm leading-relaxed">
                描述你的世界设定想法
                <br />
                AI 将为你构建完整的世界观文档
              </p>
            </div>
          )}
        </ResultPanel>
      }
    />
  );
}
