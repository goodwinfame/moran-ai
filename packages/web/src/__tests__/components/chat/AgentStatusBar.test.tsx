import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as React from "react";
import { AgentStatusBar } from "../../../components/chat/AgentStatusBar";
import { useAgentStore } from "../../../stores/agent-store";

vi.mock("../../../stores/agent-store", () => ({
  useAgentStore: vi.fn(),
}));

describe("AgentStatusBar", () => {
  const onAgentClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no agents", () => {
    vi.mocked(useAgentStore).mockReturnValue({});
    const { container } = render(<AgentStatusBar onAgentClick={onAgentClick} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders agent rows when agents present", () => {
    vi.mocked(useAgentStore).mockReturnValue({
      "agent-1": {
        agentId: "agent-1",
        displayName: "执笔·剑心",
        state: "active",
        description: "写作第 38 章 · 1,847字",
        startedAt: 100,
      }
    });

    render(<AgentStatusBar onAgentClick={onAgentClick} />);
    expect(screen.getByText("执笔·剑心")).toBeDefined();
    expect(screen.getByText("写作第 38 章 · 1,847字")).toBeDefined();
  });

  it("shows overflow text for 3+ agents", () => {
    vi.mocked(useAgentStore).mockReturnValue({
      "agent-1": { agentId: "agent-1", displayName: "A", state: "active", description: "a", startedAt: 1 },
      "agent-2": { agentId: "agent-2", displayName: "B", state: "active", description: "b", startedAt: 2 },
      "agent-3": { agentId: "agent-3", displayName: "C", state: "active", description: "c", startedAt: 3 },
      "agent-4": { agentId: "agent-4", displayName: "D", state: "active", description: "d", startedAt: 4 },
    });

    render(<AgentStatusBar onAgentClick={onAgentClick} />);
    expect(screen.getByText("+2 个 Agent 工作中")).toBeDefined();
  });

  it("click calls onAgentClick", () => {
    vi.mocked(useAgentStore).mockReturnValue({
      "agent-1": {
        agentId: "agent-1",
        displayName: "执笔·剑心",
        state: "active",
        description: "写作第 38 章",
        startedAt: 100,
      }
    });

    render(<AgentStatusBar onAgentClick={onAgentClick} />);
    const row = screen.getByTestId("agent-row");
    fireEvent.click(row);
    expect(onAgentClick).toHaveBeenCalledWith("agent-1");
  });
});
