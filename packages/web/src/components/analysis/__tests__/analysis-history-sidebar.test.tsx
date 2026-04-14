import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalysisHistorySidebar } from "@/components/analysis/analysis-history-sidebar";
import type { AnalysisListItem } from "@/hooks/use-analysis";

const mockAnalyses: AnalysisListItem[] = [
  {
    id: "a1",
    workTitle: "大奉打更人",
    author: "卖报小郎君",
    status: "completed",
    dimensionCount: 9,
    techniqueCount: 5,
    createdAt: "2026-04-14T10:00:00Z",
  },
  {
    id: "a2",
    workTitle: "诡秘之主",
    author: "爱潜水的乌贼",
    status: "analyzing",
    dimensionCount: 4,
    techniqueCount: 0,
    createdAt: "2026-04-13T10:00:00Z",
  },
];

describe("AnalysisHistorySidebar", () => {
  it("renders loading state", () => {
    render(
      <AnalysisHistorySidebar
        analyses={[]}
        loading={true}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    // Loader2 spinner should be present (svg)
    const svg = document.querySelector(".animate-spin");
    expect(svg).toBeDefined();
  });

  it("renders empty state", () => {
    render(
      <AnalysisHistorySidebar
        analyses={[]}
        loading={false}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("暂无分析记录")).toBeDefined();
  });

  it("renders analysis items", () => {
    render(
      <AnalysisHistorySidebar
        analyses={mockAnalyses}
        loading={false}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/大奉打更人/)).toBeDefined();
    expect(screen.getByText(/诡秘之主/)).toBeDefined();
    expect(screen.getByText("已完成")).toBeDefined();
    expect(screen.getByText("分析中")).toBeDefined();
  });

  it("highlights selected item", () => {
    render(
      <AnalysisHistorySidebar
        analyses={mockAnalyses}
        loading={false}
        selectedId="a1"
        onSelect={() => {}}
      />,
    );
    // Selected item should have bg-accent class
    const buttons = document.querySelectorAll("button");
    const firstButton = buttons[0];
    expect(firstButton?.className).toContain("bg-accent");
  });

  it("shows dimension and technique counts", () => {
    render(
      <AnalysisHistorySidebar
        analyses={mockAnalyses}
        loading={false}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("9 维")).toBeDefined();
    expect(screen.getByText("5 技法")).toBeDefined();
  });
});
