import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { InlineChatInput } from "@/components/project-list/InlineChatInput";

describe("InlineChatInput", () => {
  it("renders input and send button", () => {
    render(<InlineChatInput onSend={vi.fn()} />);
    expect(screen.getByPlaceholderText("告诉墨衡你想写什么故事...")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("calls onSend and clears input when clicking send", () => {
    const onSend = vi.fn();
    render(<InlineChatInput onSend={onSend} />);
    const input = screen.getByRole("textbox");
    const button = screen.getByRole("button");

    fireEvent.change(input, { target: { value: "New project idea" } });
    expect(input).toHaveValue("New project idea");

    fireEvent.click(button);
    expect(onSend).toHaveBeenCalledWith("New project idea");
    expect(input).toHaveValue("");
  });

  it("calls onSend when pressing Enter", () => {
    const onSend = vi.fn();
    render(<InlineChatInput onSend={onSend} />);
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "Hit enter test" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", shiftKey: false });
    
    expect(onSend).toHaveBeenCalledWith("Hit enter test");
    expect(input).toHaveValue("");
  });

  it("does not call onSend if input is empty", () => {
    const onSend = vi.fn();
    render(<InlineChatInput onSend={onSend} />);
    
    fireEvent.click(screen.getByRole("button"));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("shows disabled state properly", () => {
    const onSend = vi.fn();
    render(<InlineChatInput onSend={onSend} disabled={true} />);
    
    const input = screen.getByRole("textbox");
    const button = screen.getByRole("button");
    
    expect(input).toBeDisabled();
    expect(button).toBeDisabled();
    expect(input).toHaveAttribute("placeholder", "墨衡思考中...");
  });
});
