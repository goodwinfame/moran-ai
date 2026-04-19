import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatMessage } from "@/stores/chat-store";

vi.mock("react-markdown", () => ({
  default: ({ children }: any) => <div data-testid="markdown">{children}</div>,
}));

vi.mock("remark-gfm", () => ({
  default: () => {},
}));

describe("MessageBubble", () => {
  it("renders user message (right aligned)", () => {
    const msg: ChatMessage = {
      id: "1",
      type: "user",
      content: "Hello from user",
      timestamp: 123,
    };
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("Hello from user")).toBeDefined();
    // User messages do not use markdown
    expect(screen.queryByTestId("markdown")).toBeNull();
  });

  it("renders assistant message (left aligned, with markdown)", () => {
    const msg: ChatMessage = {
      id: "2",
      type: "assistant",
      content: "**Hello** from assistant",
      timestamp: 123,
    };
    render(<MessageBubble message={msg} />);
    expect(screen.getByTestId("markdown").textContent).toBe("**Hello** from assistant");
  });

  it("renders system message (centered)", () => {
    const msg: ChatMessage = {
      id: "3",
      type: "system",
      content: "System notice",
      timestamp: 123,
    };
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("System notice")).toBeDefined();
  });

  it("renders progress message", () => {
    const msg: ChatMessage = {
      id: "4",
      type: "progress",
      content: "Working...",
      timestamp: 123,
    };
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("Working...")).toBeDefined();
  });

  it("renders streaming indicator when isStreaming", () => {
    const msg: ChatMessage = {
      id: "5",
      type: "assistant",
      content: "Streaming text",
      timestamp: 123,
    };
    render(<MessageBubble message={msg} isStreaming={true} />);
    const cursor = screen.getByText("▎");
    expect(cursor).toBeDefined();
    expect(cursor.className).toContain("animate-pulse");
  });

  it("renders inline actions", () => {
    const msg: ChatMessage = {
      id: "6",
      type: "assistant",
      content: "Has actions",
      timestamp: 123,
      metadata: {
        inlineActions: [{ label: "Action 1", action: "action1" }],
      },
    };
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("[Action 1]")).toBeDefined();
  });
});
