import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CostDashboard } from "@/components/manage/cost-dashboard";
import type { CostSummary } from "@/hooks/use-project-stats";

const mockCost: CostSummary = {
  totalCost: 24.80,
  averageCostPerChapter: 0.59,
  byAgent: [
    {
      agentId: "zhibi",
      agentName: "执笔",
      totalTokens: 2450000,
      promptTokens: 1800000,
      completionTokens: 650000,
      totalCost: 12.35,
      invocations: 42,
    },
    {
      agentId: "mingjing",
      agentName: "明镜",
      totalTokens: 1200000,
      promptTokens: 980000,
      completionTokens: 220000,
      totalCost: 5.80,
      invocations: 56,
    },
  ],
  dailyTrend: [
    { date: "2026-04-08", cost: 2.50 },
    { date: "2026-04-09", cost: 3.10 },
    { date: "2026-04-10", cost: 1.80 },
    { date: "2026-04-11", cost: 2.90 },
    { date: "2026-04-12", cost: 3.50 },
    { date: "2026-04-13", cost: 2.20 },
    { date: "2026-04-14", cost: 2.70 },
  ],
};

describe("CostDashboard", () => {
  it("shows loading state when null", () => {
    render(<CostDashboard cost={null} />);
    expect(screen.getByText("加载中...")).toBeDefined();
  });

  it("renders total cost", () => {
    render(<CostDashboard cost={mockCost} />);
    expect(screen.getByText("$24.80")).toBeDefined();
  });

  it("renders per-chapter average", () => {
    render(<CostDashboard cost={mockCost} />);
    expect(screen.getByText("$0.59")).toBeDefined();
  });

  it("renders agent names", () => {
    render(<CostDashboard cost={mockCost} />);
    expect(screen.getByText("执笔")).toBeDefined();
    expect(screen.getByText("明镜")).toBeDefined();
  });

  it("renders agent costs", () => {
    render(<CostDashboard cost={mockCost} />);
    expect(screen.getByText("$12.35")).toBeDefined();
    expect(screen.getByText("$5.80")).toBeDefined();
  });

  it("renders invocation counts", () => {
    render(<CostDashboard cost={mockCost} />);
    expect(screen.getByText("42次")).toBeDefined();
    expect(screen.getByText("56次")).toBeDefined();
  });

  it("renders daily trend dates", () => {
    render(<CostDashboard cost={mockCost} />);
    expect(screen.getByText("04-14")).toBeDefined();
  });
});
