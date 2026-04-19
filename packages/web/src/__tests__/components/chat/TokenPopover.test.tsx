import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { TokenPopover, type UsageSummary } from "@/components/chat/TokenPopover";

// Stub Radix Popover to render content inline (no portal issues in jsdom)
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode; className?: string; align?: string }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

const fullSummary: UsageSummary = {
  totalTokens: 45000,
  totalCostUsd: 0.1125,
  byAgent: {
    "执笔·云墨": { tokens: 30000, cost: 0.075 },
    "墨衡": { tokens: 15000, cost: 0.0375 },
  },
  byModel: {
    "claude-sonnet-4": { tokens: 40000, cost: 0.1 },
    "gpt-4o": { tokens: 5000, cost: 0.0125 },
  },
};

describe("TokenPopover", () => {
  it("renders children as trigger", () => {
    render(
      <TokenPopover projectId="proj-1" summary={null}>
        <button>0 Token</button>
      </TokenPopover>,
    );
    expect(screen.getByText("0 Token")).toBeDefined();
  });

  it("shows 暂无用量数据 when summary is null", () => {
    render(
      <TokenPopover projectId="proj-1" summary={null}>
        <button>0 Token</button>
      </TokenPopover>,
    );
    expect(screen.getByText("暂无用量数据")).toBeDefined();
  });

  it("shows total tokens and cost when summary provided", () => {
    render(
      <TokenPopover projectId="proj-1" summary={fullSummary}>
        <button>Token</button>
      </TokenPopover>,
    );
    expect(screen.getByText("45,000")).toBeDefined();
    expect(screen.getByText("≈ $0.1125 USD")).toBeDefined();
  });

  it("shows agent breakdown sorted by tokens descending", () => {
    render(
      <TokenPopover projectId="proj-1" summary={fullSummary}>
        <button>Token</button>
      </TokenPopover>,
    );
    expect(screen.getByText("执笔·云墨")).toBeDefined();
    expect(screen.getByText("墨衡")).toBeDefined();

    // Verify order: 执笔·云墨 (30000) should appear before 墨衡 (15000)
    const agentNames = screen.getAllByText(/执笔·云墨|墨衡/);
    expect(agentNames[0]?.textContent).toBe("执笔·云墨");
    expect(agentNames[1]?.textContent).toBe("墨衡");
  });

  it("shows model breakdown with cost", () => {
    render(
      <TokenPopover projectId="proj-1" summary={fullSummary}>
        <button>Token</button>
      </TokenPopover>,
    );
    expect(screen.getByText("claude-sonnet-4")).toBeDefined();
    expect(screen.getByText("gpt-4o")).toBeDefined();
    expect(screen.getByText("$0.1000")).toBeDefined();
    expect(screen.getByText("$0.0125")).toBeDefined();
  });

  it("hides agent section when byAgent is empty", () => {
    const summary: UsageSummary = { ...fullSummary, byAgent: {} };
    render(
      <TokenPopover projectId="proj-1" summary={summary}>
        <button>Token</button>
      </TokenPopover>,
    );
    expect(screen.queryByText("按 Agent")).toBeNull();
  });

  it("hides model section when byModel is empty", () => {
    const summary: UsageSummary = { ...fullSummary, byModel: {} };
    render(
      <TokenPopover projectId="proj-1" summary={summary}>
        <button>Token</button>
      </TokenPopover>,
    );
    expect(screen.queryByText("按模型")).toBeNull();
  });
});
