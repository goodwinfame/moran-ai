import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UNMHealthCard } from "@/components/manage/unm-health-card";
import type { UNMHealth } from "@/hooks/use-project-stats";

const mockHealth: UNMHealth = {
  hot: 85,
  warm: 240,
  cold: 1200,
  total: 1525,
  byCategory: {
    guidance: { hot: 12, warm: 30, cold: 150 },
    characters: { hot: 25, warm: 60, cold: 320 },
  },
};

describe("UNMHealthCard", () => {
  it("shows loading state when null", () => {
    render(<UNMHealthCard health={null} />);
    expect(screen.getByText("加载中...")).toBeDefined();
  });

  it("renders total slice count", () => {
    render(<UNMHealthCard health={mockHealth} />);
    expect(screen.getByText("1525 切片")).toBeDefined();
  });

  it("renders HOT count", () => {
    render(<UNMHealthCard health={mockHealth} />);
    expect(screen.getByText("85")).toBeDefined();
  });

  it("renders WARM count", () => {
    render(<UNMHealthCard health={mockHealth} />);
    expect(screen.getByText("240")).toBeDefined();
  });

  it("renders COLD count", () => {
    render(<UNMHealthCard health={mockHealth} />);
    expect(screen.getByText("1200")).toBeDefined();
  });

  it("renders category names", () => {
    render(<UNMHealthCard health={mockHealth} />);
    expect(screen.getByText("guidance")).toBeDefined();
    expect(screen.getByText("characters")).toBeDefined();
  });

  it("renders category totals", () => {
    render(<UNMHealthCard health={mockHealth} />);
    // guidance: 12+30+150=192, characters: 25+60+320=405
    expect(screen.getByText("192")).toBeDefined();
    expect(screen.getByText("405")).toBeDefined();
  });
});
