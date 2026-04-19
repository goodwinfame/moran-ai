import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useChatStore } from "@/stores/chat-store";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

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
});
