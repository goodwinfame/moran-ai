/**
 * Chat Store — Zustand store for the chat panel.
 * Manages messages, streaming state, input mode (normal/question), and API calls.
 *
 * Phase 5.2: chat-ui module
 */

import { create } from "zustand";
import { api } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MessageType = "user" | "assistant" | "system" | "progress" | "decision";

export interface InlineAction {
  label: string;
  action: string;
}

export interface QuestionOption {
  label: string;
  value: string;
}

export interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  metadata?: {
    interaction_mode?: "question";
    options?: QuestionOption[];
    agentName?: string;
    inlineActions?: InlineAction[];
  };
  timestamp: number;
}

export type InputMode = "normal" | "question";

export interface ChatState {
  messages: ChatMessage[];
  streamingMessageId: string | null;
  streamingText: string;
  isStreaming: boolean;
  inputMode: InputMode;
  questionOptions: QuestionOption[] | null;
  questionPrompt: string | null;
  isSending: boolean;

  // ── Actions ───────────────────────────────────────────────────────────────
  addMessage: (msg: ChatMessage) => void;
  appendStreamText: (chunk: string) => void;
  finalizeStream: () => void;
  setQuestionMode: (prompt: string, options: QuestionOption[]) => void;
  resetInputMode: () => void;
  sendMessage: (projectId: string, text: string) => Promise<void>;
  loadHistory: (projectId: string) => Promise<void>;
  clearMessages: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let messageCounter = 0;

function generateMessageId(): string {
  messageCounter += 1;
  return `msg-${Date.now()}-${messageCounter}`;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [],
  streamingMessageId: null,
  streamingText: "",
  isStreaming: false,
  inputMode: "normal",
  questionOptions: null,
  questionPrompt: null,
  isSending: false,

  addMessage: (msg: ChatMessage) => {
    set((state) => ({
      messages: [...state.messages, msg],
    }));
  },

  appendStreamText: (chunk: string) => {
    set((state) => {
      if (!state.isStreaming) {
        // First chunk — start streaming
        const id = generateMessageId();
        return {
          isStreaming: true,
          streamingMessageId: id,
          streamingText: chunk,
        };
      }
      return {
        streamingText: state.streamingText + chunk,
      };
    });
  },

  finalizeStream: () => {
    const { streamingText, streamingMessageId } = get();
    if (!streamingMessageId) return;

    const msg: ChatMessage = {
      id: streamingMessageId,
      type: "assistant",
      content: streamingText,
      timestamp: Date.now(),
    };

    set((state) => ({
      messages: [...state.messages, msg],
      streamingText: "",
      streamingMessageId: null,
      isStreaming: false,
    }));
  },

  setQuestionMode: (prompt: string, options: QuestionOption[]) => {
    set({
      inputMode: "question",
      questionPrompt: prompt,
      questionOptions: options,
    });
  },

  resetInputMode: () => {
    set({
      inputMode: "normal",
      questionPrompt: null,
      questionOptions: null,
    });
  },

  sendMessage: async (projectId: string, text: string) => {
    const userMsg: ChatMessage = {
      id: generateMessageId(),
      type: "user",
      content: text,
      timestamp: Date.now(),
    };

    set((state) => ({
      messages: [...state.messages, userMsg],
      isSending: true,
    }));

    try {
      await api.post("/api/chat/send", { projectId, message: text });
      // Response comes via SSE, not here
    } catch (err) {
      console.error("[chat-store] sendMessage failed:", err);
      const errorMsg: ChatMessage = {
        id: generateMessageId(),
        type: "system",
        content: "消息发送失败，请重试",
        timestamp: Date.now(),
      };
      set((state) => ({
        messages: [...state.messages, errorMsg],
      }));
    } finally {
      set({ isSending: false });
    }
  },

  loadHistory: async (projectId: string) => {
    try {
      const res = await api.get<{ ok: true; data: ChatMessage[] }>(
        `/api/chat/history?projectId=${projectId}`,
      );
      set({ messages: res.data });
    } catch (err) {
      console.error("[chat-store] loadHistory failed:", err);
    }
  },

  clearMessages: () => {
    set({
      messages: [],
      streamingText: "",
      streamingMessageId: null,
      isStreaming: false,
      inputMode: "normal",
      questionPrompt: null,
      questionOptions: null,
      isSending: false,
    });
  },
}));
