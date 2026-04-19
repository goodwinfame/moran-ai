"use client";

import React, { useEffect } from "react";
import { useChatStore } from "@/stores/chat-store";
import { useSSEStore } from "@/stores/sse-store";
import { api } from "@/lib/api";
import { ChatNavBar } from "./ChatNavBar";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

interface ChatPanelProps {
  projectId: string;
}

export function ChatPanel({ projectId }: ChatPanelProps) {
  const loadHistory = useChatStore((state) => state.loadHistory);
  const clearMessages = useChatStore((state) => state.clearMessages);
  const connectSSE = useSSEStore((state) => state.connect);
  const disconnectSSE = useSSEStore((state) => state.disconnect);

  useEffect(() => {
    loadHistory(projectId);

    // Fetch sessionId and connect SSE
    let cancelled = false;
    api
      .get<{ ok: boolean; data: { sessionId: string } }>(
        `/api/chat/session?projectId=${encodeURIComponent(projectId)}`,
      )
      .then((res) => {
        if (!cancelled && res.data?.sessionId) {
          connectSSE(res.data.sessionId);
        }
      })
      .catch(() => {
        // Session fetch failed — SSE won't connect, but chat still works via REST
      });

    return () => {
      cancelled = true;
      clearMessages();
      disconnectSSE();
    };
  }, [projectId, loadHistory, clearMessages, connectSSE, disconnectSSE]);

  return (
    <div className="flex flex-col h-full bg-chat-bg">
      <ChatNavBar projectId={projectId} />
      <MessageList />

      {/* AgentStatusBar placeholder — Phase 5.2 Agent C */}
      <div id="agent-status-bar-slot" />

      <ChatInput projectId={projectId} />

      {/* QuickActions placeholder — Phase 5.2 Agent C */}
      <div id="quick-actions-slot" />
    </div>
  );
}
