/**
 * Tests for SSEClient (T4)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SSEClient, SSE_EVENT_TYPES } from "@/lib/sse-client";

// ── Mock EventSource ───────────────────────────────────────────────────────────

let lastInstance: MockEventSource | null = null;

class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  readyState = MockEventSource.CONNECTING;
  url: string;
  private listeners = new Map<string, Array<(e: Event) => void>>();

  onopen: ((ev: Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    lastInstance = this;
  }

  addEventListener(type: string, listener: (e: Event) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: (e: Event) => void) {
    const arr = this.listeners.get(type);
    if (!arr) return;
    const idx = arr.indexOf(listener);
    if (idx !== -1) arr.splice(idx, 1);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  // ── test helpers ─────────────────────────────────────────────────────────

  triggerOpen() {
    this.readyState = MockEventSource.OPEN;
    this.onopen?.(new Event("open"));
  }

  triggerError() {
    this.onerror?.(new Event("error"));
  }

  triggerEvent(type: string, data: unknown, lastEventId = "") {
    const event = new MessageEvent(type, {
      data: JSON.stringify(data),
      lastEventId,
    });
    const listeners = this.listeners.get(type) ?? [];
    listeners.forEach((fn) => fn(event as unknown as Event));
  }

  triggerHeartbeat() {
    const listeners = this.listeners.get("heartbeat") ?? [];
    listeners.forEach((fn) => fn(new Event("heartbeat")));
  }
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  lastInstance = null;
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("SSEClient", () => {
  describe("connect()", () => {
    it("creates EventSource with correct URL", () => {
      const client = new SSEClient("http://localhost:3000", {});
      client.connect("session-123");

      expect(lastInstance).not.toBeNull();
      expect(lastInstance!.url).toContain("/api/chat/events");
      expect(lastInstance!.url).toContain("sessionId=session-123");
    });

    it("includes lastEventId in URL on reconnect", () => {
      const client = new SSEClient("http://localhost:3000", {});
      client.connect("session-abc");

      // Simulate receiving an event with an id
      lastInstance!.triggerOpen();
      lastInstance!.triggerEvent("text", { content: "hello" }, "evt-42");

      // Simulate an error to force reconnect
      lastInstance!.triggerError();
      vi.advanceTimersByTime(1000); // reconnect delay for attempt 1

      expect(lastInstance!.url).toContain("lastEventId=evt-42");
    });

    it("calls onConnect handler when connection opens", () => {
      const onConnect = vi.fn();
      const client = new SSEClient("http://localhost:3000", { onConnect });
      client.connect("session-x");
      lastInstance!.triggerOpen();
      expect(onConnect).toHaveBeenCalledOnce();
    });

    it("dispatches typed event data to the matching handler", () => {
      const textHandler = vi.fn();
      const client = new SSEClient("http://localhost:3000", { text: textHandler });
      client.connect("s1");
      lastInstance!.triggerOpen();
      lastInstance!.triggerEvent("text", { content: "hello world" });
      expect(textHandler).toHaveBeenCalledWith({ content: "hello world" });
    });

    it("registers all 14 event types", () => {
      const handlers = Object.fromEntries(
        SSE_EVENT_TYPES.map((t) => [t, vi.fn()]),
      );
      const client = new SSEClient("http://localhost:3000", handlers);
      client.connect("s1");
      lastInstance!.triggerOpen();

      for (const type of SSE_EVENT_TYPES) {
        lastInstance!.triggerEvent(type, { type });
      }

      for (const type of SSE_EVENT_TYPES) {
        expect(handlers[type], `handler for "${type}"`).toHaveBeenCalledWith({ type });
      }
    });

    it("resets reconnectAttempts to 0 after successful connection", () => {
      const onReconnect = vi.fn();
      const client = new SSEClient("http://localhost:3000", { onReconnect });
      client.connect("s1");

      // Fail once → reconnectAttempts becomes 1
      lastInstance!.triggerError();
      vi.advanceTimersByTime(1000);

      // Now succeed → reconnectAttempts resets
      const onConnect = vi.fn();
      // Re-connect on a fresh client to verify reset
      const client2 = new SSEClient("http://localhost:3000", { onConnect });
      client2.connect("s2");
      lastInstance!.triggerOpen();
      expect(onConnect).toHaveBeenCalled();

      client.disconnect();
      client2.disconnect();
    });
  });

  describe("reconnection with exponential backoff", () => {
    it("reconnects after 1s on first failure", () => {
      const client = new SSEClient("http://localhost:3000", {});
      client.connect("s1");
      const firstInstance = lastInstance;

      firstInstance!.triggerError();

      const instanceAfterError = lastInstance;
      expect(instanceAfterError).toBe(firstInstance); // not yet reconnected

      vi.advanceTimersByTime(999);
      expect(lastInstance).toBe(firstInstance); // still waiting

      vi.advanceTimersByTime(1);
      expect(lastInstance).not.toBe(firstInstance); // new connection opened
      client.disconnect();
    });

    it("doubles delay on successive failures (2s, 4s, 8s...)", () => {
      const client = new SSEClient("http://localhost:3000", {});
      client.connect("s1");

      const delays = [1000, 2000, 4000, 8000, 16000];
      let elapsed = 0;

      for (const delay of delays) {
        const prevInstance = lastInstance;
        lastInstance!.triggerError();
        vi.advanceTimersByTime(delay - 1);
        expect(lastInstance).toBe(prevInstance); // not yet
        vi.advanceTimersByTime(1);
        elapsed += delay;
        expect(lastInstance).not.toBe(prevInstance); // reconnected
      }
      client.disconnect();
    });

    it("caps reconnect delay at 30s", () => {
      const client = new SSEClient("http://localhost:3000", {});
      client.connect("s1");

      // Drive 5 failures to exhaust delays up to 16s, then check cap
      for (let i = 0; i < 5; i++) {
        lastInstance!.triggerError();
        vi.advanceTimersByTime(Math.min(1000 * Math.pow(2, i), 30_000));
      }

      // 6th failure should use 30s cap
      const prevInstance = lastInstance;
      lastInstance!.triggerError();
      vi.advanceTimersByTime(29_999);
      expect(lastInstance).toBe(prevInstance); // still waiting

      vi.advanceTimersByTime(1);
      expect(lastInstance).not.toBe(prevInstance);
      client.disconnect();
    });

    it("calls onReconnect with the attempt number", () => {
      const onReconnect = vi.fn();
      const client = new SSEClient("http://localhost:3000", { onReconnect });
      client.connect("s1");

      lastInstance!.triggerError();
      expect(onReconnect).toHaveBeenCalledWith(1);

      vi.advanceTimersByTime(1000);
      lastInstance!.triggerError();
      expect(onReconnect).toHaveBeenCalledWith(2);
      client.disconnect();
    });

    it("calls onDisconnect on error", () => {
      const onDisconnect = vi.fn();
      const client = new SSEClient("http://localhost:3000", { onDisconnect });
      client.connect("s1");
      lastInstance!.triggerError();
      expect(onDisconnect).toHaveBeenCalledOnce();
      client.disconnect();
    });
  });

  describe("heartbeat monitoring", () => {
    it("starts heartbeat monitor on connection open", () => {
      const client = new SSEClient("http://localhost:3000", {});
      client.connect("s1");
      lastInstance!.triggerOpen();
      const prevInstance = lastInstance;

      // 59s — should not reconnect yet
      vi.advanceTimersByTime(59_999);
      expect(lastInstance).toBe(prevInstance);

      // 60s — should reconnect
      vi.advanceTimersByTime(1);
      expect(lastInstance).not.toBe(prevInstance);
      client.disconnect();
    });

    it("resets heartbeat timer when an event is received", () => {
      const client = new SSEClient("http://localhost:3000", {});
      client.connect("s1");
      lastInstance!.triggerOpen();
      const prevInstance = lastInstance;

      // Advance 50s, then receive an event (should reset the 60s timer)
      vi.advanceTimersByTime(50_000);
      lastInstance!.triggerEvent("text", { content: "hi" });

      // 59s after the event — still no reconnect
      vi.advanceTimersByTime(59_999);
      expect(lastInstance).toBe(prevInstance);

      // 1ms more → reconnect
      vi.advanceTimersByTime(1);
      expect(lastInstance).not.toBe(prevInstance);
      client.disconnect();
    });

    it("resets heartbeat timer on heartbeat event", () => {
      const client = new SSEClient("http://localhost:3000", {});
      client.connect("s1");
      lastInstance!.triggerOpen();
      const prevInstance = lastInstance;

      vi.advanceTimersByTime(50_000);
      lastInstance!.triggerHeartbeat();

      vi.advanceTimersByTime(59_999);
      expect(lastInstance).toBe(prevInstance);

      vi.advanceTimersByTime(1);
      expect(lastInstance).not.toBe(prevInstance);
      client.disconnect();
    });
  });

  describe("disconnect()", () => {
    it("closes the EventSource", () => {
      const client = new SSEClient("http://localhost:3000", {});
      client.connect("s1");
      const inst = lastInstance!;
      client.disconnect();
      expect(inst.readyState).toBe(MockEventSource.CLOSED);
    });

    it("stops automatic reconnection", () => {
      const client = new SSEClient("http://localhost:3000", {});
      client.connect("s1");
      const prevInstance = lastInstance;

      lastInstance!.triggerError(); // schedules reconnect at 1s
      client.disconnect();

      vi.advanceTimersByTime(5_000);
      // No new EventSource should have been created
      expect(lastInstance).toBe(prevInstance);
    });

    it("clears heartbeat timer", () => {
      const client = new SSEClient("http://localhost:3000", {});
      client.connect("s1");
      lastInstance!.triggerOpen();
      client.disconnect();
      const prevInstance = lastInstance;

      // Advancing past 60s should NOT trigger a reconnect
      vi.advanceTimersByTime(70_000);
      expect(lastInstance).toBe(prevInstance);
    });
  });
});
