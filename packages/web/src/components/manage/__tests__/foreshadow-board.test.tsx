import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ForeshadowBoard } from "@/components/manage/foreshadow-board";
import type { ForeshadowItem } from "@/hooks/use-project-stats";

const mockItems: ForeshadowItem[] = [
  {
    id: "fs-1",
    title: "神秘信件",
    description: "旧宅发现的密封信件",
    status: "DEVELOPING",
    plantedChapter: 5,
    resolvedChapter: null,
    relatedCharacters: ["主角"],
  },
  {
    id: "fs-2",
    title: "断剑",
    description: "上古神兵残片",
    status: "PLANTED",
    plantedChapter: 12,
    resolvedChapter: null,
    relatedCharacters: ["铸剑师"],
  },
  {
    id: "fs-3",
    title: "北方异动",
    description: "北方军队调动",
    status: "RESOLVED",
    plantedChapter: 3,
    resolvedChapter: 28,
    relatedCharacters: ["将军"],
  },
  {
    id: "fs-4",
    title: "梦中女子",
    description: "白衣女子身份不明",
    status: "STALE",
    plantedChapter: 1,
    resolvedChapter: null,
    relatedCharacters: ["主角"],
  },
];

describe("ForeshadowBoard", () => {
  it("shows loading state", () => {
    render(<ForeshadowBoard items={[]} loading={true} />);
    expect(screen.getByText("加载中...")).toBeDefined();
  });

  it("shows empty state when no items", () => {
    render(<ForeshadowBoard items={[]} loading={false} />);
    expect(screen.getByText("暂无伏笔数据")).toBeDefined();
  });

  it("renders total count badge", () => {
    render(<ForeshadowBoard items={mockItems} loading={false} />);
    expect(screen.getByText("4 条")).toBeDefined();
  });

  it("renders column headers", () => {
    render(<ForeshadowBoard items={mockItems} loading={false} />);
    expect(screen.getByText("已埋")).toBeDefined();
    expect(screen.getByText("发展中")).toBeDefined();
    expect(screen.getByText("已揭")).toBeDefined();
    expect(screen.getByText("过期")).toBeDefined();
  });

  it("renders foreshadow titles", () => {
    render(<ForeshadowBoard items={mockItems} loading={false} />);
    expect(screen.getByText("神秘信件")).toBeDefined();
    expect(screen.getByText("断剑")).toBeDefined();
    expect(screen.getByText("北方异动")).toBeDefined();
    expect(screen.getByText("梦中女子")).toBeDefined();
  });

  it("renders chapter numbers", () => {
    render(<ForeshadowBoard items={mockItems} loading={false} />);
    expect(screen.getByText("Ch.5")).toBeDefined();
    expect(screen.getByText("Ch.12")).toBeDefined();
    expect(screen.getByText("Ch.3")).toBeDefined();
  });

  it("renders resolved chapter for resolved items", () => {
    render(<ForeshadowBoard items={mockItems} loading={false} />);
    expect(screen.getByText("Ch.28")).toBeDefined();
  });
});
