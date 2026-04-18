import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "@/components/alignment/message-bubble";

describe("MessageBubble", () => {
  it("renders assistant message content", () => {
    render(<MessageBubble role="assistant" content="你好，我是灵犀" />);
    expect(screen.getByText("你好，我是灵犀")).toBeDefined();
  });

  it("renders user message content", () => {
    render(<MessageBubble role="user" content="我想写玄幻故事" />);
    expect(screen.getByText("我想写玄幻故事")).toBeDefined();
  });

  it("assistant bubble is left-aligned (no justify-end)", () => {
    const { container } = render(<MessageBubble role="assistant" content="test" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).not.toContain("justify-end");
  });

  it("user bubble is right-aligned (justify-end)", () => {
    const { container } = render(<MessageBubble role="user" content="test" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("justify-end");
  });

  it("preserves multiline content via whitespace-pre-wrap", () => {
    const { container } = render(<MessageBubble role="assistant" content={"第一行\n第二行"} />);
    expect(container.textContent).toContain("第一行");
    expect(container.textContent).toContain("第二行");
  });
});