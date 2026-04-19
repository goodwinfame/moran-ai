/**
 * Chat Routes — Integration Tests
 *
 * Uses a local Hono test app (not createApp) because chat routes are not yet
 * mounted in app.ts (will be done separately). The test app mirrors the
 * production setup: requireAuth middleware → chat routes.
 *
 * Mocks:
 *   @moran/core/services        — auth service (for requireAuth middleware)
 *   ../../opencode/manager.js   — sessionManager singleton
 *   ../../sse/broadcaster.js    — broadcaster singleton + SSEBroadcaster class
 *   ../../sse/transformer.js    — EventTransformer class
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock @moran/core/services (required by requireAuth middleware) ──────────
const mockValidateSession = vi.fn();

vi.mock("@moran/core/services", () => ({
  authService: {
    validateSession: (...args: unknown[]) => mockValidateSession(...args),
  },
}));

// ── Mock sessionManager ─────────────────────────────────────────────────────
const mockGetOrCreateSession = vi.fn();
const mockSendMessage = vi.fn();
const mockGetMessages = vi.fn();
const mockSubscribeEvents = vi.fn();

vi.mock("../../opencode/manager.js", () => ({
  sessionManager: {
    getOrCreateSession: (...args: unknown[]) => mockGetOrCreateSession(...args),
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
    getMessages: (...args: unknown[]) => mockGetMessages(...args),
    subscribeEvents: (...args: unknown[]) => mockSubscribeEvents(...args),
  },
}));

// ── Hoisted mock objects (must be defined before vi.mock factories run) ─────
const { mockBroadcaster, mockTransform } = vi.hoisted(() => {
  const mockBroadcaster = {
    addConnection: vi.fn(),
    removeConnection: vi.fn(),
    broadcast: vi.fn().mockResolvedValue(undefined),
    buffer: vi.fn(),
    replay: vi.fn().mockReturnValue([]),
    cleanup: vi.fn(),
  };
  const mockTransform = vi.fn().mockReturnValue(null);
  return { mockBroadcaster, mockTransform };
});

// ── Mock SSEBroadcaster + broadcaster singleton ─────────────────────────────
vi.mock("../../sse/broadcaster.js", () => ({
  broadcaster: mockBroadcaster,
  SSEBroadcaster: vi.fn().mockImplementation(() => mockBroadcaster),
}));

// ── Mock EventTransformer ───────────────────────────────────────────────────
vi.mock("../../sse/transformer.js", () => ({
  EventTransformer: vi.fn().mockImplementation(() => ({
    transform: mockTransform,
  })),
}));

// Imports after mocks
import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth.js";
import { createChatRoutes } from "../../routes/chat.js";

// ── Build local test app ────────────────────────────────────────────────────
const testApp = new Hono<{ Variables: { userId: string } }>();
testApp.use("/api/chat/*", requireAuth);
testApp.route("/api/chat", createChatRoutes());

// ── Helpers ─────────────────────────────────────────────────────────────────

const AUTH_COOKIE = "session_id=test-session";
const AUTH_HEADER = { Cookie: AUTH_COOKIE };

function authenticatedSession() {
  mockValidateSession.mockResolvedValue({ ok: true, data: { userId: "user-1" } });
}

function jsonPost(path: string, body: unknown, extraHeaders: Record<string, string> = {}) {
  return testApp.request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...AUTH_HEADER,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

function jsonGet(path: string) {
  return testApp.request(path, { method: "GET", headers: AUTH_HEADER });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset broadcaster mock defaults after clearAllMocks
  mockBroadcaster.broadcast.mockResolvedValue(undefined);
  mockBroadcaster.replay.mockReturnValue([]);
});

// ── POST /api/chat/send ──────────────────────────────────────────────────────

describe("POST /api/chat/send", () => {
  it("sends message successfully and returns messageId", async () => {
    authenticatedSession();
    mockGetOrCreateSession.mockResolvedValue("session-abc");
    mockSendMessage.mockResolvedValue({ messageId: "msg-123" });

    const res = await jsonPost("/api/chat/send", {
      projectId: "proj-1",
      message: "帮我写第一章",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.messageId).toBe("msg-123");

    expect(mockGetOrCreateSession).toHaveBeenCalledWith("user-1", "proj-1");
    expect(mockSendMessage).toHaveBeenCalledWith("session-abc", "帮我写第一章");
  });

  it("accepts optional attachments field", async () => {
    authenticatedSession();
    mockGetOrCreateSession.mockResolvedValue("session-abc");
    mockSendMessage.mockResolvedValue({ messageId: "msg-456" });

    const res = await jsonPost("/api/chat/send", {
      projectId: "proj-1",
      message: "继续",
      attachments: ["ref-doc-1"],
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 400 when projectId is missing", async () => {
    authenticatedSession();

    const res = await jsonPost("/api/chat/send", {
      message: "hello",
    });

    expect(res.status).toBe(400);
    expect(mockGetOrCreateSession).not.toHaveBeenCalled();
  });

  it("returns 400 when message is missing", async () => {
    authenticatedSession();

    const res = await jsonPost("/api/chat/send", {
      projectId: "proj-1",
    });

    expect(res.status).toBe(400);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("returns 500 when session creation fails", async () => {
    authenticatedSession();
    mockGetOrCreateSession.mockRejectedValue(new Error("OpenCode unreachable"));

    const res = await jsonPost("/api/chat/send", {
      projectId: "proj-1",
      message: "hello",
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("OpenCode unreachable");
  });

  it("returns 401 when no session cookie is present", async () => {
    const res = await testApp.request("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: "proj-1", message: "hi" }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(mockGetOrCreateSession).not.toHaveBeenCalled();
  });
});

// ── GET /api/chat/session ────────────────────────────────────────────────────

describe("GET /api/chat/session", () => {
  it("returns sessionId for the given projectId", async () => {
    authenticatedSession();
    mockGetOrCreateSession.mockResolvedValue("session-xyz");

    const res = await jsonGet("/api/chat/session?projectId=proj-1");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.sessionId).toBe("session-xyz");

    expect(mockGetOrCreateSession).toHaveBeenCalledWith("user-1", "proj-1");
  });

  it("returns 400 when projectId is missing", async () => {
    authenticatedSession();

    const res = await jsonGet("/api/chat/session");

    expect(res.status).toBe(400);
    expect(mockGetOrCreateSession).not.toHaveBeenCalled();
  });

  it("returns 500 when session creation fails", async () => {
    authenticatedSession();
    mockGetOrCreateSession.mockRejectedValue(new Error("OpenCode unavailable"));

    const res = await jsonGet("/api/chat/session?projectId=proj-1");

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("OpenCode unavailable");
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await testApp.request(
      "/api/chat/session?projectId=proj-1",
      { method: "GET" },
    );

    expect(res.status).toBe(401);
    expect(mockGetOrCreateSession).not.toHaveBeenCalled();
  });
});

// ── GET /api/chat/history ────────────────────────────────────────────────────

describe("GET /api/chat/history", () => {
  it("returns message history with hasMore flag", async () => {
    authenticatedSession();
    mockGetOrCreateSession.mockResolvedValue("session-abc");
    const fakeMessages = Array.from({ length: 3 }, (_, i) => ({ id: `msg-${i}` }));
    mockGetMessages.mockResolvedValue(fakeMessages);

    const res = await jsonGet("/api/chat/history?projectId=proj-1&limit=50");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.messages).toHaveLength(3);
    // 3 messages < limit 50, so hasMore = false
    expect(body.data.hasMore).toBe(false);

    expect(mockGetOrCreateSession).toHaveBeenCalledWith("user-1", "proj-1");
    expect(mockGetMessages).toHaveBeenCalledWith("session-abc", { limit: 50 });
  });

  it("sets hasMore=true when messages fill the limit", async () => {
    authenticatedSession();
    mockGetOrCreateSession.mockResolvedValue("session-abc");
    const fakeMessages = Array.from({ length: 10 }, (_, i) => ({ id: `msg-${i}` }));
    mockGetMessages.mockResolvedValue(fakeMessages);

    const res = await jsonGet("/api/chat/history?projectId=proj-1&limit=10");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.hasMore).toBe(true);
  });

  it("uses default limit of 50 when not specified", async () => {
    authenticatedSession();
    mockGetOrCreateSession.mockResolvedValue("session-abc");
    mockGetMessages.mockResolvedValue([]);

    await jsonGet("/api/chat/history?projectId=proj-1");

    expect(mockGetMessages).toHaveBeenCalledWith("session-abc", { limit: 50 });
  });

  it("returns 400 when projectId is missing", async () => {
    authenticatedSession();

    const res = await jsonGet("/api/chat/history");

    expect(res.status).toBe(400);
    expect(mockGetOrCreateSession).not.toHaveBeenCalled();
  });

  it("returns 500 when getMessages fails", async () => {
    authenticatedSession();
    mockGetOrCreateSession.mockResolvedValue("session-abc");
    mockGetMessages.mockRejectedValue(new Error("Session not found"));

    const res = await jsonGet("/api/chat/history?projectId=proj-1");

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

// ── GET /api/chat/session ────────────────────────────────────────────────────

describe("GET /api/chat/session", () => {
  it("returns sessionId for the given projectId", async () => {
    authenticatedSession();
    mockGetOrCreateSession.mockResolvedValue("session-xyz");

    const res = await jsonGet("/api/chat/session?projectId=proj-1");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.sessionId).toBe("session-xyz");

    expect(mockGetOrCreateSession).toHaveBeenCalledWith("user-1", "proj-1");
  });

  it("returns 400 when projectId is missing", async () => {
    authenticatedSession();

    const res = await jsonGet("/api/chat/session");

    expect(res.status).toBe(400);
    expect(mockGetOrCreateSession).not.toHaveBeenCalled();
  });

  it("returns 500 when session creation throws", async () => {
    authenticatedSession();
    mockGetOrCreateSession.mockRejectedValue(new Error("OpenCode down"));

    const res = await jsonGet("/api/chat/session?projectId=proj-1");

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("OpenCode down");
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await testApp.request("/api/chat/session?projectId=proj-1", {
      method: "GET",
    });

    expect(res.status).toBe(401);
    expect(mockGetOrCreateSession).not.toHaveBeenCalled();
  });
});

// ── GET /api/chat/events ─────────────────────────────────────────────────────

describe("GET /api/chat/events", () => {
  it("returns text/event-stream content type", async () => {
    authenticatedSession();
    // subscribeEvents returns a stream that immediately closes
    mockSubscribeEvents.mockReturnValue({
      stream: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
      close: vi.fn(),
    });

    const res = await testApp.request(
      "/api/chat/events?sessionId=session-abc",
      { method: "GET", headers: AUTH_HEADER },
    );

    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    expect(mockSubscribeEvents).toHaveBeenCalledWith("session-abc");
  });

  it("returns 400 when sessionId is missing", async () => {
    authenticatedSession();

    const res = await jsonGet("/api/chat/events");

    expect(res.status).toBe(400);
    expect(mockSubscribeEvents).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await testApp.request(
      "/api/chat/events?sessionId=session-abc",
      { method: "GET" },
    );

    expect(res.status).toBe(401);
    expect(mockSubscribeEvents).not.toHaveBeenCalled();
  });

  it("registers and removes connection from broadcaster", async () => {
    authenticatedSession();
    mockSubscribeEvents.mockReturnValue({
      stream: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
      close: vi.fn(),
    });

    await testApp.request(
      "/api/chat/events?sessionId=session-abc",
      { method: "GET", headers: AUTH_HEADER },
    );

    expect(mockBroadcaster.addConnection).toHaveBeenCalledWith(
      "session-abc",
      expect.objectContaining({ connId: expect.any(String) }),
    );
    expect(mockBroadcaster.removeConnection).toHaveBeenCalledWith(
      "session-abc",
      expect.objectContaining({ connId: expect.any(String) }),
    );
  });

  it("replays missed events when Last-Event-Id header is present", async () => {
    authenticatedSession();
    const replayEvents = [
      { id: 6, type: "text" as const, data: { chunk: "..." }, timestamp: Date.now() },
    ];
    mockBroadcaster.replay.mockReturnValue(replayEvents);
    mockSubscribeEvents.mockReturnValue({
      stream: new ReadableStream({ start(c) { c.close(); } }),
      close: vi.fn(),
    });

    const res = await testApp.request(
      "/api/chat/events?sessionId=session-abc",
      {
        method: "GET",
        headers: { ...AUTH_HEADER, "Last-Event-Id": "5" },
      },
    );

    expect(mockBroadcaster.replay).toHaveBeenCalledWith("session-abc", 5);
    // Response should contain the replayed event in the SSE body
    const body = await res.text();
    expect(body).toContain("id: 6");
    expect(body).toContain("event: text");
  });

  it("transforms events via EventTransformer and broadcasts them", async () => {
    authenticatedSession();

    const rawEvent = { type: "session.event.part.text", sessionId: "session-abc", data: { chunk: "hi" } };
    const transformedEvent = { id: 1, type: "text" as const, data: { chunk: "hi" }, timestamp: Date.now() };
    mockTransform.mockReturnValue(transformedEvent);

    let enqueueEvent: ((event: unknown) => void) | undefined;
    mockSubscribeEvents.mockReturnValue({
      stream: new ReadableStream({
        start(controller) {
          enqueueEvent = (ev) => {
            controller.enqueue(ev);
            controller.close();
          };
        },
      }),
      close: vi.fn(),
    });

    // Start streaming in background, then enqueue the event
    const responsePromise = testApp.request(
      "/api/chat/events?sessionId=session-abc",
      { method: "GET", headers: AUTH_HEADER },
    );

    // Give the stream handler a tick to set up
    await new Promise((r) => setTimeout(r, 10));
    enqueueEvent?.(rawEvent);

    await responsePromise;

    expect(mockTransform).toHaveBeenCalledWith(rawEvent);
    expect(mockBroadcaster.broadcast).toHaveBeenCalledWith("session-abc", transformedEvent);
  });
});
