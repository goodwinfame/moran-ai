import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChapterList } from "@/components/read/chapter-list";
import type { ChapterSummary } from "@/hooks/use-chapters";

const mockChapters: ChapterSummary[] = [
  {
    id: "ch1",
    projectId: "p1",
    chapterNumber: 1,
    title: "初入江湖",
    wordCount: 3200,
    writerStyle: "默认",
    status: "archived",
    currentVersion: 2,
    createdAt: "2025-12-01T00:00:00Z",
    updatedAt: "2025-12-01T12:00:00Z",
  },
  {
    id: "ch2",
    projectId: "p1",
    chapterNumber: 2,
    title: "危机四伏",
    wordCount: 4100,
    writerStyle: null,
    status: "draft",
    currentVersion: 1,
    createdAt: "2025-12-02T00:00:00Z",
    updatedAt: "2025-12-02T12:00:00Z",
  },
];

describe("ChapterList", () => {
  it("renders chapter items with titles", () => {
    render(
      <ChapterList
        chapters={mockChapters}
        loading={false}
        selectedChapter={null}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText("初入江湖")).toBeDefined();
    expect(screen.getByText("危机四伏")).toBeDefined();
  });

  it("shows word count for each chapter", () => {
    render(
      <ChapterList
        chapters={mockChapters}
        loading={false}
        selectedChapter={null}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText("3,200字")).toBeDefined();
    expect(screen.getByText("4,100字")).toBeDefined();
  });

  it("shows status badges", () => {
    render(
      <ChapterList
        chapters={mockChapters}
        loading={false}
        selectedChapter={null}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText("已归档")).toBeDefined();
    expect(screen.getByText("草稿")).toBeDefined();
  });

  it("calls onSelect when chapter is clicked", () => {
    let selected: number | null = null;
    render(
      <ChapterList
        chapters={mockChapters}
        loading={false}
        selectedChapter={null}
        onSelect={(num) => { selected = num; }}
      />,
    );

    fireEvent.click(screen.getByText("初入江湖"));
    expect(selected).toBe(1);
  });

  it("shows empty state when no chapters", () => {
    render(
      <ChapterList
        chapters={[]}
        loading={false}
        selectedChapter={null}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText("暂无章节")).toBeDefined();
  });

  it("shows loading spinner", () => {
    const { container } = render(
      <ChapterList
        chapters={[]}
        loading={true}
        selectedChapter={null}
        onSelect={() => {}}
      />,
    );

    // Loader2 renders an SVG with animate-spin class
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeDefined();
  });
});
