/**
 * Tests for SSE Store (T5)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock SSEClient before importing the store so the store uses the mock
vi.mock("@/lib/sse-client", () => {
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();
  const MockSSEClient = vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    disconnect: mockDisconnect,
  }));
  return { SSEClient: MockSSEClient, SSE_EVENT_TYPES: [] };
});

import { useSSEStore } from "@/stores/sse-store";
import { SSEClient } from "@/lib/sse-client";

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetStore() {
  useSSEStore.setState({
    connectionState: "disconnected",
    reconnectAttempts: 0,
    client: null,
  });
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

afterEach(() => {
  resetStore();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("useSSEStore", () => {
  describe("initial state", () => {
    it("starts disconnected with no client", () => {
      const state = useSSEStore.getState();
      expect(state.connectionState).toBe("disconnected");
      expect(state.reconnectAttempts).toBe(0);
      expect(state.client).toBeNull();
    });
  });

  describe("connect()", () => {
    it("sets connectionState to connecting", () => {
      useSSEStore.getState().connect("session-1");
      expect(useSSEStore.getState().connectionState).toBe("connecting");
    });

    it("creates an SSEClient instance", () => {
      useSSEStore.getState().connect("session-1");
      expect(SSEClient).toHaveBeenCalledOnce();
    });

    it("calls client.connect() with the sessionId", () => {
      useSSEStore.getState().connect("session-abc");
      const instance = (SSEClient as ReturnType<typeof vi.fn>).mock.results[0]!.value;
      expect(instance.connect).toHaveBeenCalledWith("session-abc");
    });

    it("stores the client reference in state", () => {
      useSSEStore.getState().connect("session-1");
      expect(useSSEStore.getState().client).not.toBeNull();
    });

    it("disconnects any existing client before creating a new one", () => {
      // First connect
      useSSEStore.getState().connect("session-1");
      const firstInstance = (SSEClient as ReturnType<typeof vi.fn>).mock.results[0]!.value;

      // Second connect
      useSSEStore.getState().connect("session-2");
      expect(firstInstance.disconnect).toHaveBeenCalledOnce();
    });

    it("updates connectionState to connected via onConnect callback", () => {
      useSSEStore.getState().connect("session-1");

      // Retrieve the handlers passed to SSEClient constructor
      const ctorArgs = (SSEClient as ReturnType<typeof vi.fn>).mock.calls[0]!;
      const handlers = ctorArgs[1] as { onConnect?: () => void };
      handlers.onConnect?.();

      expect(useSSEStore.getState().connectionState).toBe("connected");
      expect(useSSEStore.getState().reconnectAttempts).toBe(0);
    });

    it("updates state via onDisconnect callback", () => {
      useSSEStore.getState().connect("session-1");
      const handlers = (SSEClient as ReturnType<typeof vi.fn>).mock.calls[0]![1] as {
        onDisconnect?: () => void;
      };
      handlers.onDisconnect?.();
      expect(useSSEStore.getState().connectionState).toBe("disconnected");
    });

    it("updates state via onReconnect callback", () => {
      useSSEStore.getState().connect("session-1");
      const handlers = (SSEClient as ReturnType<typeof vi.fn>).mock.calls[0]![1] as {
        onReconnect?: (attempt: number) => void;
      };
      handlers.onReconnect?.(3);
      expect(useSSEStore.getState().connectionState).toBe("connecting");
      expect(useSSEStore.getState().reconnectAttempts).toBe(3);
    });
  });

  describe("disconnect()", () => {
    it("sets connectionState to disconnected", () => {
      useSSEStore.getState().connect("session-1");
      useSSEStore.getState().disconnect();
      expect(useSSEStore.getState().connectionState).toBe("disconnected");
    });

    it("calls client.disconnect()", () => {
      useSSEStore.getState().connect("session-1");
      const instance = (SSEClient as ReturnType<typeof vi.fn>).mock.results[0]!.value;
      useSSEStore.getState().disconnect();
      expect(instance.disconnect).toHaveBeenCalledOnce();
    });

    it("clears the client reference", () => {
      useSSEStore.getState().connect("session-1");
      useSSEStore.getState().disconnect();
      expect(useSSEStore.getState().client).toBeNull();
    });

    it("resets reconnectAttempts to 0", () => {
      useSSEStore.getState().connect("session-1");
      const handlers = (SSEClient as ReturnType<typeof vi.fn>).mock.calls[0]![1] as {
        onReconnect?: (attempt: number) => void;
      };
      handlers.onReconnect?.(5);
      useSSEStore.getState().disconnect();
      expect(useSSEStore.getState().reconnectAttempts).toBe(0);
    });

    it("is safe to call when already disconnected", () => {
      expect(() => useSSEStore.getState().disconnect()).not.toThrow();
    });
  });
});
