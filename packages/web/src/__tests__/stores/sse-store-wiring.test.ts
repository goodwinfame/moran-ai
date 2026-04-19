/**
 * Tests for SSE store event handler wiring (Phase 5.3)
 * Verifies that SSE events correctly update chat-store, agent-store, and panel-store.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock SSEClient
vi.mock("@/lib/sse-client", () => {
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();
  const MockSSEClient = vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    disconnect: mockDisconnect,
  }));
  return { SSEClient: MockSSEClient, SSE_EVENT_TYPES: [] };
});

// Mock idb-keyval
vi.mock("idb-keyval", () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
}));

import { useSSEStore } from "@/stores/sse-store";
import { useChatStore } from "@/stores/chat-store";
import { useAgentStore } from "@/stores/agent-store";
import { usePanelStore } from "@/stores/panel-store";
import { SSEClient } from "@/lib/sse-client";

// ── Helpers ───────────────────────────────────────────────────────────────────

type HandlerMap = Record<string, (data: Record<string, unknown>) => void> & {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onReconnect?: (attempt: number) => void;
};

function getHandlers(): HandlerMap {
  const calls = (SSEClient as ReturnType<typeof vi.fn>).mock.calls;
  const lastCall = calls[calls.length - 1];
  return lastCall?.[1] as HandlerMap;
}

function connectAndGetHandlers(): HandlerMap {
  useSSEStore.getState().connect("session-1");
  return getHandlers();
}

function resetStores() {
  useSSEStore.setState({ connectionState: "disconnected", reconnectAttempts: 0, client: null });
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
  useAgentStore.setState({ agents: {} });
  usePanelStore.setState({
    activeTab: "brainstorm",
    visibleTabs: [],
    badges: {},
    lastUserActionTime: 0,
    brainstorm: null,
    world: null,
    characters: null,
    outline: null,
    foreshadows: null,
    timeline: null,
    chapters: null,
    reviews: null,
    analysis: null,
    externalAnalysis: null,
    knowledge: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStores();
});

afterEach(() => {
  resetStores();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("SSE store wiring", () => {
  describe("text event", () => {
    it("appends text to chat store streaming buffer", () => {
      const handlers = connectAndGetHandlers();
      handlers["text"]?.({ text: "hello " });
      handlers["text"]?.({ text: "world" });
      expect(useChatStore.getState().streamingText).toBe("hello world");
    });
  });

  describe("tool_result event", () => {
    it("adds visible tab for known tool", () => {
      const handlers = connectAndGetHandlers();
      usePanelStore.setState({ lastUserActionTime: 0 });
      handlers["tool_result"]?.({ toolName: "world_create" });
      expect(usePanelStore.getState().visibleTabs).toContain("world");
    });

    it("switches to tab when user last acted > 10s ago", () => {
      const handlers = connectAndGetHandlers();
      usePanelStore.setState({ lastUserActionTime: Date.now() - 15_000 });
      handlers["tool_result"]?.({ toolName: "world_create" });
      expect(usePanelStore.getState().activeTab).toBe("world");
    });

    it("adds badge instead of switching when user acted < 10s ago", () => {
      const handlers = connectAndGetHandlers();
      // Pre-populate visibleTabs so addVisibleTab doesn't auto-activate the first tab
      usePanelStore.setState({
        visibleTabs: ["brainstorm"],
        activeTab: "brainstorm",
        lastUserActionTime: Date.now() - 1_000,
      });
      handlers["tool_result"]?.({ toolName: "world_create" });
      expect(usePanelStore.getState().activeTab).toBe("brainstorm");
      expect(usePanelStore.getState().badges["world"]).toEqual({ type: "dot" });
    });

    it("ignores unknown tool names", () => {
      const handlers = connectAndGetHandlers();
      handlers["tool_result"]?.({ toolName: "unknown_tool" });
      expect(usePanelStore.getState().visibleTabs).toHaveLength(0);
    });
  });

  describe("subtask_start event", () => {
    it("adds agent to agent store", () => {
      const handlers = connectAndGetHandlers();
      handlers["subtask_start"]?.({
        agentId: "agent-1",
        displayName: "匠心",
        state: "active",
        description: "设计世界观",
      });
      expect(useAgentStore.getState().agents["agent-1"]).toBeDefined();
      expect(useAgentStore.getState().agents["agent-1"]?.displayName).toBe("匠心");
    });
  });

  describe("subtask_progress event", () => {
    it("updates agent description", () => {
      useAgentStore.getState().addAgent({
        agentId: "agent-1",
        displayName: "匠心",
        state: "active",
        description: "初始",
        startedAt: Date.now(),
      });
      const handlers = connectAndGetHandlers();
      handlers["subtask_progress"]?.({ agentId: "agent-1", description: "更新中" });
      expect(useAgentStore.getState().agents["agent-1"]?.description).toBe("更新中");
    });
  });

  describe("subtask_end event", () => {
    it("sets agent state to just_finished", () => {
      useAgentStore.getState().addAgent({
        agentId: "agent-1",
        displayName: "匠心",
        state: "active",
        description: "工作中",
        startedAt: Date.now(),
      });
      const handlers = connectAndGetHandlers();
      handlers["subtask_end"]?.({ agentId: "agent-1" });
      expect(useAgentStore.getState().agents["agent-1"]?.state).toBe("just_finished");
    });
  });

  describe("error event", () => {
    it("adds system message to chat store", () => {
      const handlers = connectAndGetHandlers();
      handlers["error"]?.({ message: "出错了" });
      const messages = useChatStore.getState().messages;
      expect(messages.some((m) => m.type === "system" && m.content === "出错了")).toBe(true);
    });
  });

  describe("interaction_mode event", () => {
    it("sets question mode when mode=question", () => {
      const handlers = connectAndGetHandlers();
      handlers["interaction_mode"]?.({
        mode: "question",
        prompt: "选择方向",
        options: [{ label: "A", value: "a" }, { label: "B", value: "b" }],
      });
      expect(useChatStore.getState().inputMode).toBe("question");
      expect(useChatStore.getState().questionPrompt).toBe("选择方向");
    });

    it("resets input mode for other modes", () => {
      useChatStore.setState({ inputMode: "question", questionPrompt: "test", questionOptions: [] });
      const handlers = connectAndGetHandlers();
      handlers["interaction_mode"]?.({ mode: "normal" });
      expect(useChatStore.getState().inputMode).toBe("normal");
    });
  });

  describe("chapter.token event", () => {
    it("appends token to chapter streaming content", () => {
      const handlers = connectAndGetHandlers();
      handlers["chapter.token"]?.({ token: "第一章" });
      handlers["chapter.token"]?.({ token: "内容" });
      expect(usePanelStore.getState().chapters?.streamingContent).toBe("第一章内容");
    });
  });

  describe("brainstorm.diverge event", () => {
    it("adds direction to brainstorm diverge list", () => {
      const handlers = connectAndGetHandlers();
      handlers["brainstorm.diverge"]?.({ id: "dir-1", title: "方向一" });
      expect(usePanelStore.getState().brainstorm?.diverge).toHaveLength(1);
      expect(usePanelStore.getState().brainstorm?.diverge[0]?.title).toBe("方向一");
    });

    it("adds brainstorm to visible tabs", () => {
      const handlers = connectAndGetHandlers();
      handlers["brainstorm.diverge"]?.({ id: "dir-1", title: "方向一" });
      expect(usePanelStore.getState().visibleTabs).toContain("brainstorm");
    });
  });
});
