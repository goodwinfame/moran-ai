/**
 * OpenCodeSessionManager — Unit Tests
 *
 * Mocks @opencode-ai/sdk to avoid real network calls.
 * Uses vitest for assertions and mocking.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the SDK before importing the module under test
vi.mock("@opencode-ai/sdk", () => ({
  createOpencodeClient: vi.fn(),
}));

import { createOpencodeClient } from "@opencode-ai/sdk";
import {
  OpenCodeSessionManager,
  type OpenCodeEvent,
} from "../../opencode/manager.js";

const mockCreateClient = vi.mocked(createOpencodeClient);

const mockClient = {
  session: {
    create: vi.fn(),
    list: vi.fn(),
    messages: vi.fn(),
    promptAsync: vi.fn(),
  },
  global: {
    event: vi.fn(),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateClient.mockReturnValue(
    mockClient as unknown as ReturnType<typeof createOpencodeClient>,
  );
});

// ---------------------------------------------------------------------------
// getOrCreateSession
// ---------------------------------------------------------------------------
describe("getOrCreateSession", () => {
  it("creates a new session when none exists", async () => {
    mockClient.session.create.mockResolvedValue({ data: { id: "sess-abc" } });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    const sessionId = await manager.getOrCreateSession("user1", "proj1");

    expect(sessionId).toBe("sess-abc");
    expect(mockClient.session.create).toHaveBeenCalledWith({
      body: { title: "moran-user1-proj1" },
    });
    expect(manager.activeCount).toBe(1);
  });

  it("returns the same session on repeated calls (idempotent)", async () => {
    mockClient.session.create.mockResolvedValue({ data: { id: "sess-abc" } });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    const first = await manager.getOrCreateSession("user1", "proj1");
    const second = await manager.getOrCreateSession("user1", "proj1");

    expect(first).toBe(second);
    expect(mockClient.session.create).toHaveBeenCalledTimes(1);
  });

  it("throws when session.create returns no id", async () => {
    mockClient.session.create.mockResolvedValue({ data: null });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    await expect(manager.getOrCreateSession("user1", "proj1")).rejects.toThrow(
      "OpenCode session.create returned no id",
    );
  });
});

// ---------------------------------------------------------------------------
// checkHealth
// ---------------------------------------------------------------------------
describe("checkHealth", () => {
  it("resolves successfully when serve is reachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 200 } as Response),
    );
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    await expect(manager.checkHealth()).resolves.toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("throws with descriptive message when serve is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    await expect(manager.checkHealth()).rejects.toThrow("不可达");
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// restore
// ---------------------------------------------------------------------------
describe("restore", () => {
  it("restores sessions matching the moran-{userId}-{projectId} title pattern", async () => {
    mockClient.session.list.mockResolvedValue({
      data: [
        {
          id: "sess-1",
          title: "moran-user1-proj1",
          time: { created: 100, updated: 200 },
        },
        {
          id: "sess-2",
          title: "moran-user2-proj2",
          time: { created: 300, updated: 400 },
        },
      ],
    });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    const count = await manager.restore();

    expect(count).toBe(2);
    expect(manager.activeCount).toBe(2);
  });

  it("skips sessions with non-matching titles", async () => {
    mockClient.session.list.mockResolvedValue({
      data: [
        {
          id: "sess-3",
          title: "opencode-some-other-session",
          time: { created: 100, updated: 200 },
        },
        {
          id: "sess-4",
          title: "moran-userA-projB",
          time: { created: 300, updated: 400 },
        },
      ],
    });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    const count = await manager.restore();

    expect(count).toBe(1);
    expect(manager.activeCount).toBe(1);
  });

  it("does not overwrite sessions already in the in-memory map", async () => {
    mockClient.session.create.mockResolvedValue({ data: { id: "local-sess" } });
    mockClient.session.list.mockResolvedValue({
      data: [
        {
          id: "remote-sess",
          title: "moran-user1-proj1",
          time: { created: 100, updated: 200 },
        },
      ],
    });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });
    // Pre-populate the map via getOrCreateSession
    await manager.getOrCreateSession("user1", "proj1");

    const count = await manager.restore();

    expect(count).toBe(0);
    expect(manager.activeCount).toBe(1);
    // The original local session id should be preserved (getOrCreateSession re-uses it)
    const id = await manager.getOrCreateSession("user1", "proj1");
    expect(id).toBe("local-sess");
  });

  it("returns 0 when OpenCode has no sessions", async () => {
    mockClient.session.list.mockResolvedValue({ data: [] });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    const count = await manager.restore();

    expect(count).toBe(0);
    expect(manager.activeCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getMessages
// ---------------------------------------------------------------------------
describe("getMessages", () => {
  it("returns the messages array from the SDK", async () => {
    const messages = [
      { info: { id: "msg-1", role: "user", sessionID: "sess-1" }, parts: [] },
    ];
    mockClient.session.messages.mockResolvedValue({ data: messages });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    const result = await manager.getMessages("sess-1");

    expect(result).toEqual(messages);
    expect(mockClient.session.messages).toHaveBeenCalledWith({
      path: { id: "sess-1" },
      query: { limit: undefined },
    });
  });

  it("passes the limit option to the SDK", async () => {
    mockClient.session.messages.mockResolvedValue({ data: [] });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    await manager.getMessages("sess-1", { limit: 25 });

    expect(mockClient.session.messages).toHaveBeenCalledWith({
      path: { id: "sess-1" },
      query: { limit: 25 },
    });
  });

  it("returns an empty array when SDK returns null data", async () => {
    mockClient.session.messages.mockResolvedValue({ data: null });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    const result = await manager.getMessages("sess-1");

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// sendMessage
// ---------------------------------------------------------------------------
describe("sendMessage", () => {
  it("sends text content via promptAsync", async () => {
    mockClient.session.promptAsync.mockResolvedValue({
      data: { info: { id: "msg-xyz" } },
    });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    const result = await manager.sendMessage("sess-1", "Hello, world!");

    expect(mockClient.session.promptAsync).toHaveBeenCalledWith({
      path: { id: "sess-1" },
      body: {
        parts: [{ type: "text", text: "Hello, world!" }],
        agent: undefined,
      },
    });
    expect(result).toEqual({ messageId: "msg-xyz" });
  });

  it("passes the agent option to the SDK", async () => {
    mockClient.session.promptAsync.mockResolvedValue({
      data: { info: { id: "msg-456" } },
    });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    await manager.sendMessage("sess-1", "Start brainstorm", { agent: "lingxi" });

    expect(mockClient.session.promptAsync).toHaveBeenCalledWith({
      path: { id: "sess-1" },
      body: {
        parts: [{ type: "text", text: "Start brainstorm" }],
        agent: "lingxi",
      },
    });
  });

  it("returns empty messageId when SDK response has no id", async () => {
    mockClient.session.promptAsync.mockResolvedValue({ data: undefined });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    const result = await manager.sendMessage("sess-1", "ping");

    expect(result).toEqual({ messageId: "" });
  });
});

// ---------------------------------------------------------------------------
// release
// ---------------------------------------------------------------------------
describe("release", () => {
  it("removes the session from the internal map", async () => {
    mockClient.session.create.mockResolvedValue({ data: { id: "sess-1" } });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });
    await manager.getOrCreateSession("user1", "proj1");
    expect(manager.activeCount).toBe(1);

    manager.release("user1", "proj1");

    expect(manager.activeCount).toBe(0);
  });

  it("is a no-op when the session does not exist", () => {
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    expect(() => manager.release("unknown", "unknown")).not.toThrow();
    expect(manager.activeCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// sweep (private — accessed via unknown cast)
// ---------------------------------------------------------------------------
describe("sweep", () => {
  it("removes sessions that have exceeded the TTL", async () => {
    mockClient.session.create.mockResolvedValue({ data: { id: "sess-1" } });
    // TTL of 0 ms means any session is instantly expired
    const manager = new OpenCodeSessionManager({
      baseUrl: "http://test",
      ttlMs: 0,
    });
    await manager.getOrCreateSession("user1", "proj1");
    expect(manager.activeCount).toBe(1);

    // Wait 1 ms so lastActiveAt is strictly older than now - ttlMs (0)
    await new Promise((resolve) => setTimeout(resolve, 1));
    (manager as unknown as { sweep(): void }).sweep();

    expect(manager.activeCount).toBe(0);
  });

  it("keeps sessions that have not exceeded the TTL", async () => {
    mockClient.session.create.mockResolvedValue({ data: { id: "sess-1" } });
    const manager = new OpenCodeSessionManager({
      baseUrl: "http://test",
      ttlMs: 60_000, // 60 seconds — will not expire
    });
    await manager.getOrCreateSession("user1", "proj1");
    expect(manager.activeCount).toBe(1);

    (manager as unknown as { sweep(): void }).sweep();

    expect(manager.activeCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// subscribeEvents
// ---------------------------------------------------------------------------
describe("subscribeEvents", () => {
  type StreamEvent = {
    payload: { type: string; properties: Record<string, unknown> } | null;
  };

  async function* makeEventStream(events: StreamEvent[]) {
    for (const e of events) {
      yield e;
    }
  }

  it("filters events by sessionId — only matching events reach the stream", async () => {
    mockClient.global.event.mockResolvedValue({
      stream: makeEventStream([
        {
          payload: {
            type: "message.part",
            properties: { sessionID: "target-sess" },
          },
        },
        {
          payload: {
            type: "message.part",
            properties: { sessionID: "other-sess" },
          },
        },
        {
          payload: {
            type: "message.complete",
            properties: { sessionID: "target-sess" },
          },
        },
      ]),
    });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    const { stream } = manager.subscribeEvents("target-sess");
    const reader = stream.getReader();
    const collected: OpenCodeEvent[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      collected.push(value);
    }

    expect(collected).toHaveLength(2);
    expect(collected.every((e) => e.sessionId === "target-sess")).toBe(true);
  });

  it("extracts sessionID from properties.sessionID", async () => {
    mockClient.global.event.mockResolvedValue({
      stream: makeEventStream([
        {
          payload: {
            type: "session.updated",
            properties: { sessionID: "target-sess" },
          },
        },
      ]),
    });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    const { stream } = manager.subscribeEvents("target-sess");
    const reader = stream.getReader();
    const { value } = await reader.read();

    expect(value?.sessionId).toBe("target-sess");
  });

  it("extracts sessionID from properties.part.sessionID", async () => {
    mockClient.global.event.mockResolvedValue({
      stream: makeEventStream([
        {
          payload: {
            type: "message.part",
            properties: { part: { sessionID: "target-sess" } },
          },
        },
      ]),
    });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    const { stream } = manager.subscribeEvents("target-sess");
    const reader = stream.getReader();
    const { value } = await reader.read();

    expect(value?.sessionId).toBe("target-sess");
  });

  it("extracts sessionID from properties.info.sessionID", async () => {
    mockClient.global.event.mockResolvedValue({
      stream: makeEventStream([
        {
          payload: {
            type: "session.created",
            properties: { info: { sessionID: "target-sess" } },
          },
        },
      ]),
    });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    const { stream } = manager.subscribeEvents("target-sess");
    const reader = stream.getReader();
    const { value } = await reader.read();

    expect(value?.sessionId).toBe("target-sess");
  });

  it("maps event type and data correctly onto the OpenCodeEvent", async () => {
    const props: Record<string, unknown> = {
      sessionID: "target-sess",
      content: "hello",
    };
    mockClient.global.event.mockResolvedValue({
      stream: makeEventStream([
        { payload: { type: "message.text", properties: props } },
      ]),
    });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    const { stream } = manager.subscribeEvents("target-sess");
    const reader = stream.getReader();
    const { value } = await reader.read();

    expect(value?.type).toBe("message.text");
    expect(value?.sessionId).toBe("target-sess");
    expect(value?.data).toEqual(props);
  });

  it("close() aborts the stream so subsequent events are not delivered", async () => {
    let resolveSecondYield!: () => void;
    const secondYieldReady = new Promise<void>((r) => {
      resolveSecondYield = r;
    });

    async function* controlledStream() {
      yield {
        payload: {
          type: "ping",
          properties: { sessionID: "target-sess" },
        },
      };
      await secondYieldReady;
      yield {
        payload: {
          type: "pong",
          properties: { sessionID: "target-sess" },
        },
      };
    }

    mockClient.global.event.mockResolvedValue({ stream: controlledStream() });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });
    const { stream, close } = manager.subscribeEvents("target-sess");
    const reader = stream.getReader();

    // Read the first event
    const first = await reader.read();
    expect(first.value?.type).toBe("ping");

    // Abort before the second event is processed
    close();
    // Unblock the generator — the abort check in the loop will discard "pong"
    resolveSecondYield();

    // Stream should terminate without delivering "pong"
    const next = await reader.read();
    expect(next.done).toBe(true);
  });

  it("skips events with no payload", async () => {
    mockClient.global.event.mockResolvedValue({
      stream: makeEventStream([{ payload: null }]),
    });
    const manager = new OpenCodeSessionManager({ baseUrl: "http://test" });

    const { stream } = manager.subscribeEvents("target-sess");
    const reader = stream.getReader();
    const collected: OpenCodeEvent[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      collected.push(value);
    }

    expect(collected).toHaveLength(0);
  });
});
