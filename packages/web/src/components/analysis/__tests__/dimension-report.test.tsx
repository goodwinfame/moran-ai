import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DimensionReport } from "@/components/analysis/dimension-report";
import type { DimensionResult } from "@/hooks/use-analysis";

const mockDimensions: DimensionResult[] = [
  {
    dimension: "narrative_structure",
    label: "① 叙事结构分析",
    content: "## 叙事结构分析\n\n这是一段分析内容。\n\n### 子标题\n- 要点一\n- 要点二",
    actionableInsights: ["建议一：多线叙事", "建议二：控制视角"],
    consumers: ["lingxi", "jiangxin"],
  },
  {
    dimension: "character_design",
    label: "② 角色设计技法",
    content: "## 角色设计\n\n角色分析内容。",
    actionableInsights: ["角色建议一"],
    consumers: ["zhibi"],
  },
  {
    dimension: "foreshadowing",
    label: "④ 伏笔与线索",
    content: "伏笔分析",
    actionableInsights: [],
    consumers: [],
  },
];

describe("DimensionReport", () => {
  it("renders all dimension cards", () => {
    render(<DimensionReport dimensions={mockDimensions} />);
    expect(screen.getByText("① 叙事结构分析")).toBeDefined();
    expect(screen.getByText("② 角色设计技法")).toBeDefined();
    expect(screen.getByText("④ 伏笔与线索")).toBeDefined();
  });

  it("shows first dimension expanded by default", () => {
    render(<DimensionReport dimensions={mockDimensions} />);
    // First dimension content should be visible
    expect(screen.getByText("可操作建议")).toBeDefined();
    expect(screen.getByText(/建议一：多线叙事/)).toBeDefined();
  });

  it("toggles dimension expand/collapse", () => {
    render(<DimensionReport dimensions={mockDimensions} />);

    // Click second dimension to expand it
    fireEvent.click(screen.getByText("② 角色设计技法"));
    // The insight text is rendered inside an <li> with "• " prefix
    expect(screen.getByText(/角色建议一/)).toBeDefined();
  });

  it("shows expand all / collapse all buttons", () => {
    render(<DimensionReport dimensions={mockDimensions} />);
    expect(screen.getByText("全部展开")).toBeDefined();
    expect(screen.getByText("全部收起")).toBeDefined();
  });

  it("expand all shows all content", () => {
    render(<DimensionReport dimensions={mockDimensions} />);
    fireEvent.click(screen.getByText("全部展开"));
    // All dimensions should show their insights badges
    const badges = screen.getAllByText(/建议/);
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });

  it("collapse all hides all content", () => {
    render(<DimensionReport dimensions={mockDimensions} />);
    fireEvent.click(screen.getByText("全部收起"));
    // actionableInsights header should not be visible
    expect(screen.queryByText("可操作建议")).toBeNull();
  });

  it("renders empty state", () => {
    render(<DimensionReport dimensions={[]} />);
    expect(screen.getByText("暂无维度分析数据")).toBeDefined();
  });

  it("shows consumer badges", () => {
    render(<DimensionReport dimensions={mockDimensions} />);
    // First dimension is expanded by default, should show consumers
    expect(screen.getByText("lingxi")).toBeDefined();
    expect(screen.getByText("jiangxin")).toBeDefined();
  });
});
