import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalysisProgress } from "@/components/analysis/analysis-progress";
import type { AnalysisProgressData } from "@/hooks/use-analysis";

describe("AnalysisProgress", () => {
  it("renders search stage", () => {
    const progress: AnalysisProgressData = {
      stage: "search",
      message: "正在搜索素材…",
      progress: 0.1,
      completedDimensions: [],
    };
    render(<AnalysisProgress progress={progress} />);
    expect(screen.getByText("正在搜索素材…")).toBeDefined();
    expect(screen.getByText("10%")).toBeDefined();
    expect(screen.getByText("搜索素材")).toBeDefined();
  });

  it("renders analyze stage with dimension grid", () => {
    const progress: AnalysisProgressData = {
      stage: "analyze",
      dimension: "character_design",
      message: "正在分析② 角色设计技法…",
      progress: 0.4,
      completedDimensions: ["narrative_structure"],
    };
    render(<AnalysisProgress progress={progress} />);
    expect(screen.getByText("40%")).toBeDefined();
    // Dimension grid should be shown
    expect(screen.getByText("九维分析")).toBeDefined();
    // Grid items show shortened labels
    expect(screen.getByText(/① 叙事/)).toBeDefined();
  });

  it("renders completed progress at 100%", () => {
    const progress: AnalysisProgressData = {
      stage: "settle",
      message: "分析完成",
      progress: 1,
      completedDimensions: [
        "narrative_structure",
        "character_design",
        "world_building",
        "foreshadowing",
        "pacing_tension",
        "shuanggan_mechanics",
        "style_fingerprint",
        "dialogue_voice",
        "chapter_hooks",
      ],
    };
    render(<AnalysisProgress progress={progress} />);
    expect(screen.getByText("100%")).toBeDefined();
    expect(screen.getByText("分析完成")).toBeDefined();
  });

  it("shows all four stage labels", () => {
    const progress: AnalysisProgressData = {
      stage: "report",
      message: "生成报告中",
      progress: 0.8,
      completedDimensions: [],
    };
    render(<AnalysisProgress progress={progress} />);
    expect(screen.getByText("搜索素材")).toBeDefined();
    expect(screen.getByText("九维分析")).toBeDefined();
    expect(screen.getByText("生成报告")).toBeDefined();
    expect(screen.getByText("沉淀知识")).toBeDefined();
  });
});
