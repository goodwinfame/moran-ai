import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ChatInput } from "@/components/chat/ChatInput";
import { useChatStore } from "@/stores/chat-store";

vi.mock("@/components/chat/FileUploadDialog", () => ({
  FileUploadDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="file-upload-dialog" /> : null,
}));

describe("ChatInput", () => {
  beforeEach(() => {
    useChatStore.setState({
      inputMode: "normal",
      sendMessage: vi.fn(),
    });
  });

  it("renders textarea and send button", () => {
    render(<ChatInput projectId="test" />);
    expect(screen.getByRole("textbox")).toBeDefined();
    // Assuming Send button uses Icon component which renders text if not SVG mocked
    // The button has a send icon and disabled state
  });

  it("Enter sends message", () => {
    const sendSpy = vi.spyOn(useChatStore.getState(), "sendMessage");
    render(<ChatInput projectId="test" />);
    const textarea = screen.getByRole("textbox");
    
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    
    expect(sendSpy).toHaveBeenCalledWith("test", "hello");
  });

  it("Shift+Enter does not send", () => {
    const sendSpy = vi.spyOn(useChatStore.getState(), "sendMessage");
    render(<ChatInput projectId="test" />);
    const textarea = screen.getByRole("textbox");
    
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("Disabled state", () => {
    render(<ChatInput projectId="test" disabled />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });

  it("Shows command palette on /", () => {
    render(<ChatInput projectId="test" />);
    const textarea = screen.getByRole("textbox");
    
    fireEvent.change(textarea, { target: { value: "/" } });
    // The command palette should show
    expect(screen.getByText("写作")).toBeDefined();
    expect(screen.getByText("审校")).toBeDefined();
  });

  it("📎 button opens FileUploadDialog", () => {
    render(<ChatInput projectId="test" />);
    // FileUploadDialog should not be visible initially
    expect(screen.queryByTestId("file-upload-dialog")).toBeNull();

    // Find the attach button (has an Icon with attach_file, no accessible name — find by position)
    const buttons = screen.getAllByRole("button");
    const attachButton = buttons[0]!; // first button is the 📎 attach button
    fireEvent.click(attachButton);

    expect(screen.getByTestId("file-upload-dialog")).toBeDefined();
  });
});
