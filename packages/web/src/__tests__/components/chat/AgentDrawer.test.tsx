import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as React from "react";
import { AgentDrawer } from "../../../components/chat/AgentDrawer";

vi.mock("../../../stores/agent-store", () => ({
  useAgentStore: vi.fn((selector) => selector({
    agents: {
      "agent-1": {
        agentId: "agent-1",
        displayName: "执笔·剑心",
        state: "active",
        description: "写作第 38 章",
        startedAt: 100,
      }
    }
  })),
}));

describe("AgentDrawer", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when agentId is null", () => {
    const { container } = render(<AgentDrawer agentId={null} onClose={onClose} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders drawer when agentId is set", () => {
    render(<AgentDrawer agentId="agent-1" onClose={onClose} />);
    expect(screen.getByText("执笔·剑心")).toBeDefined();
    expect(screen.getByText("写作第 38 章")).toBeDefined();
    expect(screen.getByText("Agent 工作日志")).toBeDefined();
  });

  it("close button calls onClose", () => {
    render(<AgentDrawer agentId="agent-1" onClose={onClose} />);
    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("escape key calls onClose", () => {
    render(<AgentDrawer agentId="agent-1" onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
  
  it("backdrop click calls onClose", () => {
    render(<AgentDrawer agentId="agent-1" onClose={onClose} />);
    const backdrop = screen.getByTestId("backdrop");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });
});
