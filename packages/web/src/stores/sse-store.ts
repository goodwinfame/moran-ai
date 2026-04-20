/**
 * SSE Store — Zustand store managing SSE connection state.
 * T5: packages/web/src/stores/sse-store.ts
 *
 * Phase 5.3: Wired to chat-store, agent-store, and panel-store.
 */

import { create } from "zustand";
import { SSEClient, type SSEEventHandlers } from "@/lib/sse-client";
import { useChatStore } from "@/stores/chat-store";
import { useAgentStore } from "@/stores/agent-store";
import { usePanelStore } from "@/stores/panel-store";
import { routeToolResultToTab, handleAutoSwitch } from "@/lib/panel-event-router";
import type { AgentStatus } from "@/stores/agent-store";
import type { QuestionOption } from "@/stores/chat-store";

export type ConnectionState = "connecting" | "connected" | "disconnected";

interface SSEState {
  connectionState: ConnectionState;
  reconnectAttempts: number;
  client: SSEClient | null;

  connect: (sessionId: string) => void;
  disconnect: () => void;
}

// ── Type guards ────────────────────────────────────────────────────────────────

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNumber(v: unknown): v is number {
  return typeof v === "number";
}

function isAgentState(v: unknown): v is AgentStatus["state"] {
  return (
    v === "active" ||
    v === "queued" ||
    v === "background" ||
    v === "just_finished"
  );
}

function isQuestionOptions(v: unknown): v is QuestionOption[] {
  return (
    Array.isArray(v) &&
    v.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "label" in item &&
        "value" in item,
    )
  );
}

// ── Handler factory ────────────────────────────────────────────────────────────

function createHandlers(
  set: (partial: Partial<SSEState>) => void,
): SSEEventHandlers {
  return {
    // ── Lifecycle ─────────────────────────────────────────────────────────
    onConnect: () => {
      set({ connectionState: "connected", reconnectAttempts: 0 });
    },
    onDisconnect: () => {
      set({ connectionState: "disconnected" });
    },
    onReconnect: (attempt: number) => {
      set({ connectionState: "connecting", reconnectAttempts: attempt });
    },

    // ── Chat events ────────────────────────────────────────────────────────
    text: (data) => {
      const chunk = isString(data.text) ? data.text : "";
      useChatStore.getState().appendStreamText(chunk);
    },

    tool_call: (_data) => {
      // Tool call progress — no chat-store action needed currently
    },

    tool_result: (data) => {
      const toolName = isString(data.toolName) ? data.toolName : "";
      const tab = routeToolResultToTab(toolName);
      if (!tab) return;

      const panelStore = usePanelStore.getState();
      panelStore.addVisibleTab(tab);

      const { action } = handleAutoSwitch(tab, panelStore.lastUserActionTime);
      if (action === "switch") {
        panelStore.setActiveTab(tab);
      } else {
        panelStore.addBadge(tab, { type: "dot" });
      }
    },

    subtask_start: (data) => {
      const agentId = isString(data.agentId) ? data.agentId : String(data.agentId ?? "");
      const displayName = isString(data.displayName) ? data.displayName : "";
      const description = isString(data.description) ? data.description : "";
      const rawState = data.state;
      const state: AgentStatus["state"] = isAgentState(rawState) ? rawState : "active";
      const targetTab = isString(data.targetTab) ? data.targetTab : undefined;

      useAgentStore.getState().addAgent({
        agentId,
        displayName,
        state,
        description,
        startedAt: Date.now(),
        targetTab,
      });
    },

    subtask_progress: (data) => {
      const agentId = isString(data.agentId) ? data.agentId : String(data.agentId ?? "");
      const description = isString(data.description) ? data.description : undefined;
      useAgentStore.getState().updateAgent(agentId, { description });
    },

    subtask_end: (data) => {
      const agentId = isString(data.agentId) ? data.agentId : String(data.agentId ?? "");
      useAgentStore.getState().updateAgent(agentId, { state: "just_finished" });
    },

    error: (data) => {
      const content = isString(data.message) ? data.message : "发生错误";
      useChatStore.getState().addMessage({
        id: `err-${Date.now()}`,
        type: "system",
        content,
        timestamp: Date.now(),
      });
    },

    interaction_mode: (data) => {
      if (data.mode === "question") {
        const prompt = isString(data.prompt) ? data.prompt : "";
        const options = isQuestionOptions(data.options) ? data.options : [];
        useChatStore.getState().setQuestionMode(prompt, options);
      } else {
        useChatStore.getState().resetInputMode();
      }
    },

    message_complete: () => {
      useChatStore.getState().finalizeStream();
    },

    // ── Chapter events ─────────────────────────────────────────────────────
    "chapter.start": (data) => {
      const chapterNumber = isNumber(data.chapterNumber) ? data.chapterNumber : 0;
      const title = isString(data.title) ? data.title : "";
      const panelStore = usePanelStore.getState();
      panelStore.addVisibleTab("chapter");
      panelStore.updateChapter({
        mode: "writing",
        streamingContent: "",
        writingProgress: { current: 0, target: isNumber(data.wordTarget) ? data.wordTarget : 3000 },
        selectedChapter: chapterNumber,
        chapterList: panelStore.chapters?.chapterList.map((c) =>
          c.number === chapterNumber ? { ...c, title, status: "writing" } : c,
        ) ?? [{ number: chapterNumber, title, status: "writing", wordCount: 0 }],
      });
    },

    "chapter.token": (data) => {
      const token = isString(data.token) ? data.token : "";
      usePanelStore.getState().updateChapter({ appendContent: token });
    },

    "chapter.complete": (data) => {
      const wordCount = isNumber(data.wordCount) ? data.wordCount : 0;
      const chapterNumber = isNumber(data.chapterNumber) ? data.chapterNumber : null;
      const panelStore = usePanelStore.getState();
      panelStore.updateChapter({
        mode: "reading",
        writingProgress: null,
        chapterList: panelStore.chapters?.chapterList.map((c) =>
          c.number === chapterNumber ? { ...c, status: "completed", wordCount } : c,
        ) ?? [],
      });
      useChatStore.getState().finalizeStream();
    },

    // ── Brainstorm events ──────────────────────────────────────────────────
    "brainstorm.diverge": (data) => {
      const id = isString(data.id) ? data.id : `dir-${Date.now()}`;
      const title = isString(data.title) ? data.title : "";
      const panelStore = usePanelStore.getState();
      panelStore.addVisibleTab("brainstorm");
      panelStore.updateBrainstorm({
        diverge: [
          ...(panelStore.brainstorm?.diverge ?? []),
          { id, title, starred: false },
        ],
      });
    },

    "brainstorm.converge": (data) => {
      const panelStore = usePanelStore.getState();
      panelStore.updateBrainstorm({
        converge: {
          selectedDirections: Array.isArray(data.selectedDirections)
            ? (data.selectedDirections as string[])
            : [],
          genre: isString(data.genre) ? data.genre : "",
          coreConflict: isString(data.coreConflict) ? data.coreConflict : "",
          targetAudience: isString(data.targetAudience) ? data.targetAudience : "",
        },
      });
    },

    "brainstorm.crystallize": (data) => {
      const panelStore = usePanelStore.getState();
      panelStore.updateBrainstorm({
        crystal: {
          title: isString(data.title) ? data.title : "",
          type: isString(data.type) ? data.type : "",
          concept: isString(data.concept) ? data.concept : "",
          sellingPoints: isString(data.sellingPoints) ? data.sellingPoints : "",
          wordTarget: isString(data.wordTarget) ? data.wordTarget : "",
          oneLiner: isString(data.oneLiner) ? data.oneLiner : "",
        },
      });
    },
  };
}

export const useSSEStore = create<SSEState>()((set, get) => ({
  connectionState: "disconnected",
  reconnectAttempts: 0,
  client: null,

  connect: (sessionId: string) => {
    // Disconnect any existing client before creating a new one
    get().client?.disconnect();

    const client = new SSEClient("/api", createHandlers(set));
    set({ client, connectionState: "connecting", reconnectAttempts: 0 });
    client.connect(sessionId);
  },

  disconnect: () => {
    get().client?.disconnect();
    set({ client: null, connectionState: "disconnected", reconnectAttempts: 0 });
  },
}));
