"use client";

import { useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { AlignmentLayout } from "@/components/alignment/alignment-layout";
import { ChatPanel } from "@/components/alignment/chat-panel";
import { MessageBubble } from "@/components/alignment/message-bubble";
import { ResultPanel } from "@/components/alignment/result-panel";
import { SchemeTabs } from "@/components/alignment/scheme-tabs";
import { usePreparationStore } from "@/stores/preparation-store";

// 与 packages/server/src/routes/intent.ts 的 IntentScheme 保持同步
interface IntentScheme {
  id: string;
  label: string;
  核心冲突: string;
  故事卖点: string[];
  基调: string;
  目标读者感受: string;
}


const WELCOME_MESSAGE = "你好！我是灵犀，负责帮你梳理创作方向。请告诉我你的故事灵感——哪怕只是一个模糊的想法也没关系，我会帮你提炼出几个清晰的创作方向。";

export default function IntentPage() {
  const params = useParams();
  const projectId = (params?.id as string) ?? "unknown";

  const { messages, schemes, isLoading, addMessage, setSchemes, setLoading, reset } =
    usePreparationStore();

  const activeSchemeId = schemes.find((s) => s.isActive)?.id ?? schemes[0]?.id ?? "";
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 初始化：重置 store 并显示欢迎消息
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

  const handleSend = useCallback(
    async (text: string) => {
      // 追加用户消息
      addMessage({ id: `u-${Date.now()}`, role: "user", content: text, timestamp: Date.now() });
      setLoading(true);

      try {
        const res = await fetch(`/api/projects/${projectId}/intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });

        const data = await res.json() as { reply?: string; schemes?: IntentScheme[]; error?: string };

        if (!res.ok) {
          addMessage({
            id: `err-${Date.now()}`,
            role: "assistant",
            content: `出了点问题：${data.error ?? "未知错误"}，请重试。`,
            timestamp: Date.now(),
          });
          return;
        }

        // 追加 AI 回复
        if (data.reply) {
          addMessage({ id: `a-${Date.now()}`, role: "assistant", content: data.reply, timestamp: Date.now() });
        }

        // 更新方案 Tabs
        if (data.schemes && data.schemes.length > 0) {
          setSchemes(
            data.schemes.map((s, i) => ({
              id: s.id,
              label: s.label,
              content: JSON.stringify(s),
              isActive: i === 0,
            }))
          );
        }
      } catch (err) {
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
    [projectId, addMessage, setLoading, setSchemes]
  );

  // 解析当前激活方案的内容
  const activeScheme = schemes.find((s) => s.id === activeSchemeId);
  const activeSchemeData: IntentScheme | null = activeScheme
    ? (() => {
        try { return JSON.parse(activeScheme.content) as IntentScheme; } catch { return null; }
      })()
    : null;

  const schemeTabs = schemes.map((s) => ({ id: s.id, label: s.label }));

  return (
    <AlignmentLayout
      chat={
        <ChatPanel
          title="创作意图对齐"
          subtitle="让 AI 理解你想写什么样的故事"
          onSend={handleSend}
          isLoading={isLoading}
          inputPlaceholder="描述你的创作想法..."
        >
          {messages.map((msg) => (
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
          ))}
          {isLoading && (
            <MessageBubble role="assistant" content="灵犀正在思考..." />
          )}
          <div ref={messagesEndRef} />
        </ChatPanel>
      }
      result={
        <ResultPanel
          title="创作意图"
          ctaText={schemes.length > 0 ? "采用此方案并继续" : undefined}
          headerSlot={
            schemeTabs.length > 1 ? (
              <SchemeTabs
                tabs={schemeTabs}
                activeId={activeSchemeId}
                onTabChange={(id) => {
                  setSchemes(schemes.map((s) => ({ ...s, isActive: s.id === id })));
                }}
              />
            ) : undefined
          }
        >
          {activeSchemeData ? (
            <div className="space-y-4">
              {(["核心冲突", "故事卖点", "基调", "目标读者感受"] as const).map((key) => {
                const value = activeSchemeData[key as keyof IntentScheme];
                return (
                  <div key={key} className="flex justify-between items-start text-sm">
                    <span className="text-slate-400 shrink-0 mt-0.5">{key}</span>
                    <span className="text-slate-800 font-medium text-right max-w-[65%]">
                      {Array.isArray(value) ? value.join(" · ") : String(value ?? "")}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 space-y-3">
              <span className="text-3xl">✦</span>
              <p className="text-sm leading-relaxed">
                告诉灵犀你的创作灵感<br />AI 将为你生成结构化的意图方案
              </p>
            </div>
          )}
        </ResultPanel>
      }
    />
  );
}