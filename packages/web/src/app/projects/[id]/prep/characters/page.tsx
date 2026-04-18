"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AlignmentLayout } from "@/components/alignment/alignment-layout";
import { ChatPanel } from "@/components/alignment/chat-panel";
import { MessageBubble } from "@/components/alignment/message-bubble";
import { ResultPanel } from "@/components/alignment/result-panel";
import { SchemeTabs } from "@/components/alignment/scheme-tabs";
import { usePreparationStore } from "@/stores/preparation-store";

// 与 core/src/jiangxin/types.ts 保持同步
interface PsychologyModel {
  want: string;
  need: string;
  lie: string;
  ghost: string;
}

interface CharacterProfile {
  id: string;
  name: string;
  role: "protagonist" | "deuteragonist" | "antagonist" | "supporting" | "minor";
  description: string;
  biography: string;
  psychology: PsychologyModel;
  quirks: {
    catchphrase?: string;
    habits: string[];
    eccentricities: string[];
  };
  relationships: Array<{
    targetId: string;
    targetName: string;
    type: string;
    description: string;
    tension?: string;
  }>;
  arcDescription: string;
}

const ROLE_LABELS: Record<string, string> = {
  protagonist: "主角",
  deuteragonist: "第二主角",
  antagonist: "反派",
  supporting: "配角",
  minor: "龙套",
};

const WELCOME_MESSAGE =
  "你好！我是匠心，负责帮你塑造有血有肉的角色。请描述你想要的角色——可以是一个概括性的想法，也可以是具体的角色需求。我会结合世界观来设计角色体系。";

export default function CharactersPage() {
  const params = useParams();
  const projectId = (params?.id as string) ?? "unknown";

  const { messages, isLoading, addMessage, setLoading, reset } =
    usePreparationStore();

  const [characters, setCharacters] = useState<CharacterProfile[]>([]);
  const [activeCharIdx, setActiveCharIdx] = useState(0);
  const [worldOverview, setWorldOverview] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 初始化：重置 store + 加载世界观作为上下文
  useEffect(() => {
    reset();
    addMessage({
      id: "welcome",
      role: "assistant",
      content: WELCOME_MESSAGE,
      timestamp: Date.now(),
    });

    // 获取世界观概述作为角色设计上下文
    fetch(`/api/projects/${projectId}/world`)
      .then((res) => res.json())
      .then((data: { settings?: Array<{ content: string }> }) => {
        if (data.settings && data.settings.length > 0) {
          const overview = data.settings
            .map((s) => s.content)
            .join("\n");
          setWorldOverview(overview);
        }
      })
      .catch(() => {
        // 世界观未设定也不阻塞角色设计
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
          `/api/projects/${projectId}/characters/align`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              briefSummary: text,
              worldOverview: worldOverview || "尚未设定世界观",
            }),
          }
        );

        const json = (await res.json()) as {
          reply?: string;
          data?: { characters: CharacterProfile[] };
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

        if (json.data?.characters && json.data.characters.length > 0) {
          setCharacters(json.data.characters);
          setActiveCharIdx(0);
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
    [projectId, worldOverview, addMessage, setLoading]
  );

  const activeChar = characters[activeCharIdx] ?? null;
  const charTabs = characters.map((ch, i) => ({
    id: String(i),
    label: ch.name,
  }));

  return (
    <AlignmentLayout
      chat={
        <ChatPanel
          title="角色对齐"
          subtitle="AI 匠心帮你塑造有血有肉的角色"
          onSend={handleSend}
          isLoading={isLoading}
          inputPlaceholder="描述你想要的角色..."
        >
          {messages.map((msg) => (
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
          ))}
          {isLoading && (
            <MessageBubble role="assistant" content="匠心正在设计角色..." />
          )}
          <div ref={messagesEndRef} />
        </ChatPanel>
      }
      result={
        <ResultPanel
          title="角色卡片"
          ctaText={characters.length > 0 ? "确认角色并继续" : undefined}
          headerSlot={
            charTabs.length > 1 ? (
              <SchemeTabs
                tabs={charTabs}
                activeId={String(activeCharIdx)}
                onTabChange={(id) => setActiveCharIdx(Number(id))}
              />
            ) : undefined
          }
        >
          {activeChar ? (
            <div className="space-y-6">
              {/* 基本信息 */}
              <div>
                <div className="border-l-4 border-[#1A202C] pl-4 py-1 mb-4">
                  <h4 className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">
                    基本信息
                  </h4>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-start text-sm">
                    <span className="text-slate-400 shrink-0">姓名</span>
                    <span className="text-slate-800 font-medium text-right">
                      {activeChar.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-start text-sm">
                    <span className="text-slate-400 shrink-0">角色定位</span>
                    <span className="text-slate-800 font-medium text-right">
                      {ROLE_LABELS[activeChar.role] ?? activeChar.role}
                    </span>
                  </div>
                  <div className="flex justify-between items-start text-sm">
                    <span className="text-slate-400 shrink-0 mt-0.5">描述</span>
                    <span className="text-slate-800 font-medium text-right max-w-[65%]">
                      {activeChar.description}
                    </span>
                  </div>
                </div>
              </div>

              {/* 传记 */}
              {activeChar.biography && (
                <div>
                  <div className="border-l-4 border-[#1A202C] pl-4 py-1 mb-4">
                    <h4 className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">
                      传记
                    </h4>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {activeChar.biography}
                  </p>
                </div>
              )}

              {/* 四维心理模型 */}
              <div>
                <div className="border-l-4 border-[#1A202C] pl-4 py-1 mb-4">
                  <h4 className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">
                    四维心理模型
                  </h4>
                </div>
                <div className="space-y-3">
                  {(
                    [
                      ["want", "表面渴望"],
                      ["need", "真实需求"],
                      ["lie", "信奉谎言"],
                      ["ghost", "创伤来源"],
                    ] as const
                  ).map(([key, label]) => (
                    <div
                      key={key}
                      className="flex justify-between items-start text-sm"
                    >
                      <span className="text-slate-400 shrink-0 mt-0.5">
                        {label}
                      </span>
                      <span className="text-slate-800 font-medium text-right max-w-[65%]">
                        {activeChar.psychology[key]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 角色弧线 */}
              {activeChar.arcDescription && (
                <div>
                  <div className="border-l-4 border-[#1A202C] pl-4 py-1 mb-4">
                    <h4 className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">
                      角色弧线
                    </h4>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {activeChar.arcDescription}
                  </p>
                </div>
              )}

              {/* 人物关系 */}
              {activeChar.relationships.length > 0 && (
                <div>
                  <div className="border-l-4 border-[#1A202C] pl-4 py-1 mb-4">
                    <h4 className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">
                      人物关系
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {activeChar.relationships.map((rel, i) => (
                      <div
                        key={i}
                        className="bg-slate-50 rounded-lg p-3 text-sm"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-slate-800">
                            {rel.targetName}
                          </span>
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                            {rel.type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          {rel.description}
                        </p>
                        {rel.tension && (
                          <p className="text-xs text-amber-600 mt-1">
                            张力：{rel.tension}
                          </p>
                        )}
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
                描述你想要的角色
                <br />
                AI 将为你设计完整的角色体系
              </p>
            </div>
          )}
        </ResultPanel>
      }
    />
  );
}
