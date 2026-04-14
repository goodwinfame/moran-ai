import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TechniqueCards } from "@/components/analysis/technique-cards";
import type { WritingTechnique } from "@/hooks/use-analysis";

const mockTechniques: WritingTechnique[] = [
  {
    id: "t1",
    title: "多线叙事交织",
    description: "三线并进的叙事结构",
    sourceDimension: "narrative_structure",
    category: "writing_technique",
    settled: false,
  },
  {
    id: "t2",
    title: "角色缺陷驱动",
    description: "角色的核心缺陷推动情节",
    sourceDimension: "character_design",
    category: "writing_technique",
    settled: true,
  },
  {
    id: "t3",
    title: "契诃夫之枪变体",
    description: "假伏笔和真伏笔的交替运用",
    sourceDimension: "foreshadowing",
    category: "genre_knowledge",
    settled: false,
  },
];

describe("TechniqueCards", () => {
  it("renders all technique cards", () => {
    render(<TechniqueCards techniques={mockTechniques} onSettle={() => {}} />);
    expect(screen.getByText("多线叙事交织")).toBeDefined();
    expect(screen.getByText("角色缺陷驱动")).toBeDefined();
    expect(screen.getByText("契诃夫之枪变体")).toBeDefined();
  });

  it("shows settled badge for settled techniques", () => {
    render(<TechniqueCards techniques={mockTechniques} onSettle={() => {}} />);
    expect(screen.getByText("已沉淀")).toBeDefined();
  });

  it("shows settle button for unsettled techniques", () => {
    render(<TechniqueCards techniques={mockTechniques} onSettle={() => {}} />);
    const settleButtons = screen.getAllByText("沉淀");
    // Two unsettled techniques should have settle buttons
    expect(settleButtons.length).toBe(2);
  });

  it("shows batch settle button", () => {
    render(<TechniqueCards techniques={mockTechniques} onSettle={() => {}} />);
    expect(screen.getByText("全部沉淀到知识库")).toBeDefined();
    expect(screen.getByText("2 条技法可沉淀")).toBeDefined();
  });

  it("calls onSettle with single technique ID", () => {
    const onSettle = vi.fn();
    render(<TechniqueCards techniques={mockTechniques} onSettle={onSettle} />);
    const settleButtons = screen.getAllByText("沉淀");
    const firstBtn = settleButtons[0]!;
    fireEvent.click(firstBtn);
    expect(onSettle).toHaveBeenCalledWith(["t1"]);
  });

  it("calls onSettle with all unsettled IDs for batch", () => {
    const onSettle = vi.fn();
    render(<TechniqueCards techniques={mockTechniques} onSettle={onSettle} />);
    fireEvent.click(screen.getByText("全部沉淀到知识库"));
    expect(onSettle).toHaveBeenCalledWith(["t1", "t3"]);
  });

  it("shows category labels", () => {
    render(<TechniqueCards techniques={mockTechniques} onSettle={() => {}} />);
    expect(screen.getAllByText("写作技法").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("类型知识")).toBeDefined();
  });

  it("renders empty state", () => {
    render(<TechniqueCards techniques={[]} onSettle={() => {}} />);
    expect(screen.getByText("暂无提取的写作技法")).toBeDefined();
  });

  it("shows settled count", () => {
    render(<TechniqueCards techniques={mockTechniques} onSettle={() => {}} />);
    expect(screen.getByText("1 条技法已沉淀到知识库")).toBeDefined();
  });
});
