import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as React from "react";
import { QuickActions } from "../../../components/chat/QuickActions";

describe("QuickActions", () => {
  const onSendMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 5 buttons", () => {
    render(<QuickActions projectId="test-project" onSendMessage={onSendMessage} />);
    expect(screen.getByText("继续写作")).toBeDefined();
    expect(screen.getByText("送审校")).toBeDefined();
    expect(screen.getByText("查看进度")).toBeDefined();
    expect(screen.getByText("导出")).toBeDefined();
    expect(screen.getByText("暂停")).toBeDefined();
  });

  it("click '继续写作' sends message", () => {
    render(<QuickActions projectId="test-project" onSendMessage={onSendMessage} />);
    const btn = screen.getByText("继续写作").closest("button")!;
    fireEvent.click(btn);
    expect(onSendMessage).toHaveBeenCalledWith("继续写下一章");
  });

  it("click '暂停' sends pause message", () => {
    render(<QuickActions projectId="test-project" onSendMessage={onSendMessage} />);
    const btn = screen.getByText("暂停").closest("button")!;
    fireEvent.click(btn);
    expect(onSendMessage).toHaveBeenCalledWith("暂停当前工作");
  });
});
