"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AlignmentLayout } from "@/components/alignment/alignment-layout";
import { ChatPanel } from "@/components/alignment/chat-panel";
import { MessageBubble } from "@/components/alignment/message-bubble";
import { ResultPanel } from "@/components/alignment/result-panel";
import { SchemeTabs } from "@/components/alignment/scheme-tabs";
import { usePreparationStore } from "@/stores/preparation-store";

interface StyleListItem {
  styleId: string;
  displayName: string;
  genre: string;
  description: string;
  source: "builtin" | "user" | "fork";
  forkedFrom: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  builtin: "内置",
  user: "用户创建",
  fork: "自定义 (Fork)",
};

const WELCOME_MESSAGE =
  "你好！我是匠心，负责帮你确定叙事风格。告诉我你想要的文风方向——比如题材偏好、语气要求、参考作品等，我会为你推荐合适的风格配置。";

export default function StylePage() {
  const params = useParams();
  const projectId = (params?.id as string) ?? "unknown";

  const { messages, isLoading, addMessage, setLoading, reset } =
    usePreparationStore();

  const [styles, setStyles] = useState<StyleListItem[]>([]);
  const [activeStyleIdx, setActiveStyleIdx] = useState(0);
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
          `/api/projects/${projectId}/styles/align`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ genre: text, requirements: text }),
          }
        );

        const json = (await res.json()) as {
          reply?: string;
          data?: { recommended: StyleListItem[]; total: number };
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

        if (json.data?.recommended && json.data.recommended.length > 0) {
          setStyles(json.data.recommended);
          setActiveStyleIdx(0);
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

  const activeStyle = styles[activeStyleIdx] ?? null;
  const styleTabs = styles.map((s, i) => ({
    id: String(i),
    label: s.displayName,
  }));

  return (
    <AlignmentLayout
      chat={
        <ChatPanel
          title="文风对齐"
          subtitle="找到属于你的叙事风格"
          onSend={handleSend}
          isLoading={isLoading}
          inputPlaceholder="描述你想要的文风方向..."
        >
          {messages.map((msg) => (
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
          ))}
          {isLoading && (
            <MessageBubble role="assistant" content="正在匹配风格..." />
          )}
          <div ref={messagesEndRef} />
        </ChatPanel>
      }
      result={
        <ResultPanel
          title="风格配置"
          ctaText={styles.length > 0 ? "确认文风并继续" : undefined}
          headerSlot={
            styleTabs.length > 1 ? (
              <SchemeTabs
                tabs={styleTabs}
                activeId={String(activeStyleIdx)}
                onTabChange={(id) => setActiveStyleIdx(Number(id))}
              />
            ) : undefined
          }
        >
          {activeStyle ? (
            <div className="space-y-6">
              {/* 风格详情 */}
              <div>
                <div className="border-l-4 border-[#1A202C] pl-4 py-1 mb-4">
                  <h4 className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">
                    风格详情
                  </h4>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-start text-sm">
                    <span className="text-slate-400 shrink-0">名称</span>
                    <span className="text-slate-800 font-medium text-right">
                      {activeStyle.displayName}
                    </span>
                  </div>
                  <div className="flex justify-between items-start text-sm">
                    <span className="text-slate-400 shrink-0">适用题材</span>
                    <span className="text-slate-800 font-medium text-right">
                      {activeStyle.genre}
                    </span>
                  </div>
                  <div className="flex justify-between items-start text-sm">
                    <span className="text-slate-400 shrink-0">来源</span>
                    <span className="text-[#1A202C] font-bold text-right px-3 py-1 bg-slate-100 rounded-md">
                      {SOURCE_LABELS[activeStyle.source] ?? activeStyle.source}
                    </span>
                  </div>
                  {activeStyle.forkedFrom && (
                    <div className="flex justify-between items-start text-sm">
                      <span className="text-slate-400 shrink-0">基于</span>
                      <span className="text-slate-800 font-medium text-right">
                        {activeStyle.forkedFrom}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-start text-sm">
                    <span className="text-slate-400 shrink-0 mt-0.5">
                      描述
                    </span>
                    <span className="text-slate-800 font-medium text-right max-w-[65%]">
                      {activeStyle.description}
                    </span>
                  </div>
                </div>
              </div>

              {/* 全部可选风格列表 */}
              {styles.length > 1 && (
                <div>
                  <div className="border-l-4 border-[#1A202C] pl-4 py-1 mb-4">
                    <h4 className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">
                      所有推荐风格 ({styles.length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {styles.map((s, i) => (
                      <button
                        key={s.styleId}
                        onClick={() => setActiveStyleIdx(i)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          i === activeStyleIdx
                            ? "border-[#1A202C] bg-slate-50"
                            : "border-slate-100 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-800">
                            {s.displayName}
                          </span>
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                            {SOURCE_LABELS[s.source] ?? s.source}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {s.genre} · {s.description.slice(0, 50)}
                          {s.description.length > 50 ? "..." : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 space-y-3">
              <span className="text-3xl">✦</span>
              <p className="text-sm leading-relaxed">
                描述你想要的文风方向
                <br />
                AI 将为你推荐合适的风格配置
              </p>
            </div>
          )}
        </ResultPanel>
      }
    />
  );
}
