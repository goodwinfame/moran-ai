/**
 * SSE Store — Zustand store managing SSE connection state.
 * T5: packages/web/src/stores/sse-store.ts
 *
 * NOTE (Phase 5): Wire up event handlers to chat-store, agent-store, and
 * panel-event-router once those stores are ready.
 */

import { create } from "zustand";
import { SSEClient, type SSEEventHandlers } from "@/lib/sse-client";

export type ConnectionState = "connecting" | "connected" | "disconnected";

interface SSEState {
  connectionState: ConnectionState;
  reconnectAttempts: number;
  client: SSEClient | null;

  connect: (sessionId: string) => void;
  disconnect: () => void;
}

/**
 * Build the event handler map for SSEClient.
 * Each handler is a stub with a TODO for Phase 5 integration.
 */
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
    text: (_data) => {
      // TODO (Phase 5): useChatStore.getState().appendText(data)
    },
    tool_call: (_data) => {
      // TODO (Phase 5): useChatStore.getState().setToolProgress(data)
    },
    tool_result: (_data) => {
      // TODO (Phase 5): const tab = routeToolResultToTab(data.toolName as string)
      // TODO (Phase 5): if (tab) { panelStore.refreshTab(tab); handleAutoSwitch(tab, ...) }
    },
    subtask_start: (_data) => {
      // TODO (Phase 5): useAgentStore.getState().addAgent(data as AgentStatus)
    },
    subtask_progress: (_data) => {
      // TODO (Phase 5): useAgentStore.getState().updateAgent(data.agentId, { description: data.description })
    },
    subtask_end: (_data) => {
      // TODO (Phase 5): useAgentStore.getState().updateAgent(data.agentId, { state: 'just_finished' })
    },
    error: (_data) => {
      // TODO (Phase 5): useChatStore.getState().appendError(data)
    },
    interaction_mode: (_data) => {
      // TODO (Phase 5): useChatStore.getState().setInteractionMode(data)
    },

    // ── Chapter events ─────────────────────────────────────────────────────
    "chapter.start": (_data) => {
      // TODO (Phase 5): usePanelStore.getState().startChapterWriting(data)
    },
    "chapter.token": (_data) => {
      // TODO (Phase 5): usePanelStore.getState().appendChapterToken(data)
    },
    "chapter.complete": (_data) => {
      // TODO (Phase 5): usePanelStore.getState().completeChapterWriting(data)
    },

    // ── Brainstorm events ──────────────────────────────────────────────────
    "brainstorm.diverge": (_data) => {
      // TODO (Phase 5): usePanelStore.getState().appendBrainstormDiverge(data)
    },
    "brainstorm.converge": (_data) => {
      // TODO (Phase 5): usePanelStore.getState().updateBrainstormConverge(data)
    },
    "brainstorm.crystallize": (_data) => {
      // TODO (Phase 5): usePanelStore.getState().renderBrainstormCrystal(data)
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
