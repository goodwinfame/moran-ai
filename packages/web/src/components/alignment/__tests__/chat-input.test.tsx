import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatInput } from "@/components/alignment/chat-input";

describe("ChatInput", () => {
  it("renders input with default placeholder", () => {
    render(<ChatInput />);
    const input = screen.getByPlaceholderText("描述你的想法...");
    expect(input).toBeDefined();
  });

  it("renders custom placeholder", () => {
    render(<ChatInput placeholder="请输入灵感..." />);
    expect(screen.getByPlaceholderText("请输入灵感...")).toBeDefined();
  });

  it("calls onSend with trimmed text on button click", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "  玄幻故事  " } });
    fireEvent.click(screen.getByRole("button"));
    expect(onSend).toHaveBeenCalledWith("玄幻故事");
  });

  it("calls onSend on Enter key", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "我的想法" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("我的想法");
  });

  it("does not call onSend on Shift+Enter", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "内容" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not call onSend with empty/whitespace text", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("clears input after sending", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "内容" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.value).toBe("");
  });

  it("disables input and button when disabled=true", () => {
    render(<ChatInput disabled />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    const button = screen.getByRole("button");
    expect(input.disabled).toBe(true);
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not call onSend when disabled", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "内容" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });
});