import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useChatStore } from "@/stores/chat-store";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Stub ChatNavBar to avoid project.wordCount crash in test environment
vi.mock("@/components/chat/ChatNavBar", () => ({
  ChatNavBar: () => null,
}));

// ── Hoisted mocks (must be defined before vi.mock factories run) ──────────────

const { mockApiGet, mockConnect, mockDisconnect } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockConnect: vi.fn(),
  mockDisconnect: vi.fn(),
}));

// ── api mock ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    put: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  },
}));

// ── sse-store mock ────────────────────────────────────────────────────────────
// useSSEStore is called as a React hook: useSSEStore((state) => state.connect)
// The mock must be callable and return the right slice based on the selector.

vi.mock("@/stores/sse-store", () => ({
  useSSEStore: vi.fn((selector: (s: { connect: typeof mockConnect; disconnect: typeof mockDisconnect }) => unknown) =>
    selector({ connect: mockConnect, disconnect: mockDisconnect }),
  ),
}));

// ─────────────────────────────────────────────────────────────────────────────

describe("ChatPanel", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    useChatStore.setState({
      messages: [],
      isStreaming: false,
      inputMode: "normal",
      loadHistory: vi.fn(),
      clearMessages: vi.fn(),
    });
    // Default: session fetch returns a sessionId
    mockApiGet.mockResolvedValue({ data: { sessionId: "default-session" } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<ChatPanel projectId="test-id" />);
    expect(screen.getByRole("textbox")).toBeDefined();
  });

  it("loads history on mount", () => {
    const loadSpy = vi.spyOn(useChatStore.getState(), "loadHistory");
    render(<ChatPanel projectId="test-id" />);
    expect(loadSpy).toHaveBeenCalledWith("test-id");
  });

  it("clears messages on unmount", () => {
    const clearSpy = vi.spyOn(useChatStore.getState(), "clearMessages");
    const { unmount } = render(<ChatPanel projectId="test-id" />);
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });

  it("calls SSE connect on mount with sessionId from API", async () => {
    mockApiGet.mockResolvedValue({ data: { sessionId: "session-from-api" } });
    render(<ChatPanel projectId="proj-42" />);

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledWith("session-from-api");
    });
    expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringContaining("/api/chat/session?projectId=proj-42"),
    );
  });

  it("calls SSE disconnect on unmount", async () => {
    const { unmount } = render(<ChatPanel projectId="proj-42" />);
    await waitFor(() => expect(mockConnect).toHaveBeenCalled());

    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("does not call SSE connect when session fetch fails", async () => {
    mockApiGet.mockRejectedValue(new Error("Network error"));
    render(<ChatPanel projectId="test-id" />);

    await new Promise((r) => setTimeout(r, 20));
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("does not call SSE connect when sessionId is missing in response", async () => {
    mockApiGet.mockResolvedValue({ data: {} });
    render(<ChatPanel projectId="test-id" />);

    await new Promise((r) => setTimeout(r, 20));
    expect(mockConnect).not.toHaveBeenCalled();
  });
});
