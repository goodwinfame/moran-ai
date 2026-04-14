import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressDashboard } from "@/components/manage/progress-dashboard";
import type { WritingProgress } from "@/hooks/use-project-stats";

const mockProgress: WritingProgress = {
  totalWords: 128450,
  totalChapters: 42,
  currentArc: 2,
  averageWordsPerChapter: 3058,
  dailyAverage: 6400,
  targetWordCount: 500000,
  completionPercentage: 25.7,
};

describe("ProgressDashboard", () => {
  it("shows loading state when null", () => {
    render(<ProgressDashboard progress={null} />);
    expect(screen.getByText("加载中...")).toBeDefined();
  });

  it("renders total words", () => {
    render(<ProgressDashboard progress={mockProgress} />);
    expect(screen.getByText("128,450")).toBeDefined();
  });

  it("renders chapter count", () => {
    render(<ProgressDashboard progress={mockProgress} />);
    expect(screen.getByText("42")).toBeDefined();
  });

  it("renders current arc", () => {
    render(<ProgressDashboard progress={mockProgress} />);
    expect(screen.getByText("第2弧")).toBeDefined();
  });

  it("renders daily average", () => {
    render(<ProgressDashboard progress={mockProgress} />);
    expect(screen.getByText("6,400字")).toBeDefined();
  });

  it("renders completion percentage", () => {
    render(<ProgressDashboard progress={mockProgress} />);
    expect(screen.getByText("25.7%")).toBeDefined();
  });

  it("renders target word count", () => {
    render(<ProgressDashboard progress={mockProgress} />);
    expect(screen.getByText("目标 50万字")).toBeDefined();
  });

  it("renders average words per chapter", () => {
    render(<ProgressDashboard progress={mockProgress} />);
    expect(screen.getByText("3,058字")).toBeDefined();
  });
});
