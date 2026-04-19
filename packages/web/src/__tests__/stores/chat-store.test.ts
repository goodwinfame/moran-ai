/**
 * Tests for chat-store
 * Phase 5.2: chat-ui module
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  useChatStore,
  type ChatMessage,
  type QuestionOption,
} from "@/stores/chat-store";

// ── Mock @/lib/api ─────────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from "@/lib/api";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "test-msg-1",
    type: "user",
    content: "测试内容",
    timestamp: 1000,
    ...overrides,
  };
}

function resetStore() {
  useChatStore.setState({
    messages: [],
    streamingMessageId: null,
    streamingText: "",
    isStreaming: false,
    inputMode: "normal",
    questionOptions: null,
    questionPrompt: null,
    isSending: false,
  });
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("useChatStore", () => {
  describe("initial state", () => {
    it("starts with empty messages array", () => {
      expect(useChatStore.getState().messages).toEqual([]);
    });

    it("starts with isStreaming=false", () => {
      expect(useChatStore.getState().isStreaming).toBe(false);
    });

    it("starts with streamingText as empty string", () => {
      expect(useChatStore.getState().streamingText).toBe("");
    });

    it("starts with streamingMessageId=null", () => {
      expect(useChatStore.getState().streamingMessageId).toBeNull();
    });

    it("starts with inputMode='normal'", () => {
      expect(useChatStore.getState().inputMode).toBe("normal");
    });

    it("starts with questionOptions=null", () => {
      expect(useChatStore.getState().questionOptions).toBeNull();
    });

    it("starts with questionPrompt=null", () => {
      expect(useChatStore.getState().questionPrompt).toBeNull();
    });

    it("starts with isSending=false", () => {
      expect(useChatStore.getState().isSending).toBe(false);
    });
  });

  describe("addMessage()", () => {
    it("adds a message to the messages array", () => {
      const msg = makeMessage({ id: "m1", content: "Hello" });
      useChatStore.getState().addMessage(msg);
      expect(useChatStore.getState().messages).toHaveLength(1);
      expect(useChatStore.getState().messages[0]).toEqual(msg);
    });

    it("appends messages in order", () => {
      const msg1 = makeMessage({ id: "m1", content: "First" });
      const msg2 = makeMessage({ id: "m2", content: "Second" });
      useChatStore.getState().addMessage(msg1);
      useChatStore.getState().addMessage(msg2);
      const { messages } = useChatStore.getState();
      expect(messages).toHaveLength(2);
      expect(messages[0]?.id).toBe("m1");
      expect(messages[1]?.id).toBe("m2");
    });

    it("preserves existing messages when adding new one", () => {
      const existing = makeMessage({ id: "existing" });
      useChatStore.setState({ messages: [existing] });
      const newMsg = makeMessage({ id: "new" });
      useChatStore.getState().addMessage(newMsg);
      expect(useChatStore.getState().messages).toHaveLength(2);
      expect(useChatStore.getState().messages[0]?.id).toBe("existing");
    });

    it("supports all message types", () => {
      const types: Array<ChatMessage["type"]> = [
        "user",
        "assistant",
        "system",
        "progress",
        "decision",
      ];
      types.forEach((type, i) => {
        useChatStore.getState().addMessage(makeMessage({ id: `m${i}`, type }));
      });
      const { messages } = useChatStore.getState();
      expect(messages).toHaveLength(5);
      expect(messages.map((m) => m.type)).toEqual(types);
    });
  });

  describe("appendStreamText()", () => {
    it("first chunk: starts streaming, sets streamingMessageId and streamingText", () => {
      useChatStore.getState().appendStreamText("Hello");
      const state = useChatStore.getState();
      expect(state.isStreaming).toBe(true);
      expect(state.streamingMessageId).not.toBeNull();
      expect(state.streamingText).toBe("Hello");
    });

    it("first chunk: generates a non-null streamingMessageId", () => {
      useChatStore.getState().appendStreamText("chunk");
      expect(useChatStore.getState().streamingMessageId).toBeTruthy();
    });

    it("subsequent chunks: appends to streamingText", () => {
      useChatStore.getState().appendStreamText("Hello");
      useChatStore.getState().appendStreamText(", ");
      useChatStore.getState().appendStreamText("World");
      expect(useChatStore.getState().streamingText).toBe("Hello, World");
    });

    it("subsequent chunks: keeps isStreaming=true", () => {
      useChatStore.getState().appendStreamText("chunk1");
      useChatStore.getState().appendStreamText("chunk2");
      expect(useChatStore.getState().isStreaming).toBe(true);
    });

    it("subsequent chunks: keeps same streamingMessageId", () => {
      useChatStore.getState().appendStreamText("chunk1");
      const id1 = useChatStore.getState().streamingMessageId;
      useChatStore.getState().appendStreamText("chunk2");
      const id2 = useChatStore.getState().streamingMessageId;
      expect(id1).toBe(id2);
    });
  });

  describe("finalizeStream()", () => {
    it("creates an assistant message from streamingText and adds it to messages", () => {
      useChatStore.getState().appendStreamText("Full response text");
      useChatStore.getState().finalizeStream();
      const { messages } = useChatStore.getState();
      expect(messages).toHaveLength(1);
      expect(messages[0]?.type).toBe("assistant");
      expect(messages[0]?.content).toBe("Full response text");
    });

    it("resets streaming state: isStreaming=false", () => {
      useChatStore.getState().appendStreamText("text");
      useChatStore.getState().finalizeStream();
      expect(useChatStore.getState().isStreaming).toBe(false);
    });

    it("resets streaming state: streamingText=''", () => {
      useChatStore.getState().appendStreamText("text");
      useChatStore.getState().finalizeStream();
      expect(useChatStore.getState().streamingText).toBe("");
    });

    it("resets streaming state: streamingMessageId=null", () => {
      useChatStore.getState().appendStreamText("text");
      useChatStore.getState().finalizeStream();
      expect(useChatStore.getState().streamingMessageId).toBeNull();
    });

    it("uses the streamingMessageId as the message id", () => {
      useChatStore.getState().appendStreamText("text");
      const streamId = useChatStore.getState().streamingMessageId;
      useChatStore.getState().finalizeStream();
      expect(useChatStore.getState().messages[0]?.id).toBe(streamId);
    });

    it("is a no-op when streamingMessageId is null", () => {
      useChatStore.getState().finalizeStream();
      expect(useChatStore.getState().messages).toHaveLength(0);
    });

    it("appended chunks are preserved in the finalized message content", () => {
      useChatStore.getState().appendStreamText("Part1");
      useChatStore.getState().appendStreamText("Part2");
      useChatStore.getState().appendStreamText("Part3");
      useChatStore.getState().finalizeStream();
      expect(useChatStore.getState().messages[0]?.content).toBe("Part1Part2Part3");
    });
  });

  describe("setQuestionMode()", () => {
    it("sets inputMode to 'question'", () => {
      useChatStore.getState().setQuestionMode("选择方向", []);
      expect(useChatStore.getState().inputMode).toBe("question");
    });

    it("stores the prompt", () => {
      useChatStore.getState().setQuestionMode("你想要什么风格？", []);
      expect(useChatStore.getState().questionPrompt).toBe("你想要什么风格？");
    });

    it("stores the options array", () => {
      const options: QuestionOption[] = [
        { label: "武侠", value: "wuxia" },
        { label: "修仙", value: "xianxia" },
      ];
      useChatStore.getState().setQuestionMode("选择题材", options);
      expect(useChatStore.getState().questionOptions).toEqual(options);
    });

    it("stores empty options array when none provided", () => {
      useChatStore.getState().setQuestionMode("提示", []);
      expect(useChatStore.getState().questionOptions).toEqual([]);
    });
  });

  describe("resetInputMode()", () => {
    it("resets inputMode to 'normal'", () => {
      useChatStore.getState().setQuestionMode("问题", [{ label: "A", value: "a" }]);
      useChatStore.getState().resetInputMode();
      expect(useChatStore.getState().inputMode).toBe("normal");
    });

    it("clears questionOptions", () => {
      useChatStore.getState().setQuestionMode("问题", [{ label: "A", value: "a" }]);
      useChatStore.getState().resetInputMode();
      expect(useChatStore.getState().questionOptions).toBeNull();
    });

    it("clears questionPrompt", () => {
      useChatStore.getState().setQuestionMode("问题提示", []);
      useChatStore.getState().resetInputMode();
      expect(useChatStore.getState().questionPrompt).toBeNull();
    });
  });

  describe("sendMessage()", () => {
    it("adds user message immediately before API call", async () => {
      let resolveFn!: (v: unknown) => void;
      const pending = new Promise((r) => {
        resolveFn = r;
      });
      vi.mocked(api.post).mockReturnValueOnce(pending as ReturnType<typeof api.post>);

      const sendPromise = useChatStore.getState().sendMessage("proj-1", "你好");
      expect(useChatStore.getState().messages).toHaveLength(1);
      expect(useChatStore.getState().messages[0]?.type).toBe("user");
      expect(useChatStore.getState().messages[0]?.content).toBe("你好");

      resolveFn({ ok: true });
      await sendPromise;
    });

    it("sets isSending=true while in flight", async () => {
      let resolveFn!: (v: unknown) => void;
      const pending = new Promise((r) => {
        resolveFn = r;
      });
      vi.mocked(api.post).mockReturnValueOnce(pending as ReturnType<typeof api.post>);

      const sendPromise = useChatStore.getState().sendMessage("proj-1", "text");
      expect(useChatStore.getState().isSending).toBe(true);

      resolveFn({ ok: true });
      await sendPromise;
    });

    it("sets isSending=false after success", async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ ok: true });
      await useChatStore.getState().sendMessage("proj-1", "text");
      expect(useChatStore.getState().isSending).toBe(false);
    });

    it("posts to /api/chat/send with projectId and message", async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ ok: true });
      await useChatStore.getState().sendMessage("proj-abc", "Hello world");
      expect(api.post).toHaveBeenCalledWith("/api/chat/send", {
        projectId: "proj-abc",
        message: "Hello world",
      });
    });

    it("adds system error message on API failure", async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error("network error"));
      await useChatStore.getState().sendMessage("proj-1", "failing msg");
      const { messages } = useChatStore.getState();
      // Should have user message + error message
      expect(messages).toHaveLength(2);
      expect(messages[1]?.type).toBe("system");
      expect(messages[1]?.content).toContain("消息发送失败");
    });

    it("sets isSending=false after failure", async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error("fail"));
      await useChatStore.getState().sendMessage("proj-1", "msg");
      expect(useChatStore.getState().isSending).toBe(false);
    });

    it("does not throw on API failure", async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error("boom"));
      await expect(
        useChatStore.getState().sendMessage("proj-1", "msg"),
      ).resolves.toBeUndefined();
    });
  });

  describe("loadHistory()", () => {
    it("fetches and sets messages from API", async () => {
      const history: ChatMessage[] = [
        makeMessage({ id: "h1", type: "user", content: "历史消息" }),
        makeMessage({ id: "h2", type: "assistant", content: "历史回复" }),
      ];
      vi.mocked(api.get).mockResolvedValueOnce({ ok: true, data: history });

      await useChatStore.getState().loadHistory("proj-1");

      const { messages } = useChatStore.getState();
      expect(messages).toHaveLength(2);
      expect(messages[0]?.id).toBe("h1");
      expect(messages[1]?.id).toBe("h2");
    });

    it("calls GET /api/chat/history with projectId query param", async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ ok: true, data: [] });
      await useChatStore.getState().loadHistory("proj-xyz");
      expect(api.get).toHaveBeenCalledWith("/api/chat/history?projectId=proj-xyz");
    });

    it("replaces existing messages with fetched ones", async () => {
      useChatStore.setState({ messages: [makeMessage({ id: "old" })] });
      vi.mocked(api.get).mockResolvedValueOnce({
        ok: true,
        data: [makeMessage({ id: "new1" }), makeMessage({ id: "new2" })],
      });

      await useChatStore.getState().loadHistory("proj-1");
      const { messages } = useChatStore.getState();
      expect(messages).toHaveLength(2);
      expect(messages.some((m) => m.id === "old")).toBe(false);
    });

    it("does not throw on API failure", async () => {
      vi.mocked(api.get).mockRejectedValueOnce(new Error("network error"));
      await expect(
        useChatStore.getState().loadHistory("proj-1"),
      ).resolves.toBeUndefined();
    });

    it("leaves messages unchanged on failure", async () => {
      const existing = [makeMessage({ id: "keep-me" })];
      useChatStore.setState({ messages: existing });
      vi.mocked(api.get).mockRejectedValueOnce(new Error("fail"));

      await useChatStore.getState().loadHistory("proj-1");
      expect(useChatStore.getState().messages[0]?.id).toBe("keep-me");
    });
  });

  describe("clearMessages()", () => {
    it("resets messages to empty array", () => {
      useChatStore.setState({ messages: [makeMessage(), makeMessage({ id: "m2" })] });
      useChatStore.getState().clearMessages();
      expect(useChatStore.getState().messages).toEqual([]);
    });

    it("resets streamingText to empty string", () => {
      useChatStore.setState({ streamingText: "partial text" });
      useChatStore.getState().clearMessages();
      expect(useChatStore.getState().streamingText).toBe("");
    });

    it("resets streamingMessageId to null", () => {
      useChatStore.setState({ streamingMessageId: "some-id" });
      useChatStore.getState().clearMessages();
      expect(useChatStore.getState().streamingMessageId).toBeNull();
    });

    it("resets isStreaming to false", () => {
      useChatStore.setState({ isStreaming: true });
      useChatStore.getState().clearMessages();
      expect(useChatStore.getState().isStreaming).toBe(false);
    });

    it("resets inputMode to 'normal'", () => {
      useChatStore.setState({ inputMode: "question" });
      useChatStore.getState().clearMessages();
      expect(useChatStore.getState().inputMode).toBe("normal");
    });

    it("resets questionPrompt to null", () => {
      useChatStore.setState({ questionPrompt: "some question" });
      useChatStore.getState().clearMessages();
      expect(useChatStore.getState().questionPrompt).toBeNull();
    });

    it("resets questionOptions to null", () => {
      useChatStore.setState({ questionOptions: [{ label: "A", value: "a" }] });
      useChatStore.getState().clearMessages();
      expect(useChatStore.getState().questionOptions).toBeNull();
    });

    it("resets isSending to false", () => {
      useChatStore.setState({ isSending: true });
      useChatStore.getState().clearMessages();
      expect(useChatStore.getState().isSending).toBe(false);
    });
  });
});
