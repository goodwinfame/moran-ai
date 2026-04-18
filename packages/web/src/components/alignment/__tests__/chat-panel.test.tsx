import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatPanel } from "@/components/alignment/chat-panel";

describe("ChatPanel", () => {
  const noop = vi.fn();

  it("renders title and subtitle", () => {
    render(<ChatPanel title="创作意图对齐" subtitle="让 AI 理解你" onSend={noop} isLoading={false}><div /></ChatPanel>);
    expect(screen.getByText("创作意图对齐")).toBeDefined();
    expect(screen.getByText("让 AI 理解你")).toBeDefined();
  });

  it("renders children (messages)", () => {
    render(
      <ChatPanel title="T" subtitle="S" onSend={noop} isLoading={false}>
        <div>消息内容</div>
      </ChatPanel>
    );
    expect(screen.getByText("消息内容")).toBeDefined();
  });

  it("passes onSend to the input (sends on Enter)", () => {
    const onSend = vi.fn();
    render(<ChatPanel title="T" subtitle="S" onSend={onSend} isLoading={false}><div /></ChatPanel>);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "测试灵感" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("测试灵感");
  });

  it("disables input when isLoading=true", () => {
    render(<ChatPanel title="T" subtitle="S" onSend={noop} isLoading={true}><div /></ChatPanel>);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it("uses custom inputPlaceholder", () => {
    render(<ChatPanel title="T" subtitle="S" onSend={noop} isLoading={false} inputPlaceholder="描述想法..."><div /></ChatPanel>);
    expect(screen.getByPlaceholderText("描述想法...")).toBeDefined();
  });
});