import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChapterReviewSelector, type ReviewSummary } from "@/components/review/chapter-review-selector";

const mockReviews: ReviewSummary[] = [
  { chapterNumber: 1, chapterTitle: "起源", status: "passed", latestScore: 88, roundCount: 2 },
  { chapterNumber: 2, chapterTitle: "征途", status: "failed", latestScore: 62, roundCount: 1 },
  { chapterNumber: 3, chapterTitle: null, status: "pending", latestScore: null, roundCount: 0 },
];

describe("ChapterReviewSelector", () => {
  it("shows loading state", () => {
    const { container } = render(
      <ChapterReviewSelector reviews={[]} loading={true} selectedChapter={null} onSelect={() => {}} />,
    );
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("shows empty state when no reviews", () => {
    render(
      <ChapterReviewSelector reviews={[]} loading={false} selectedChapter={null} onSelect={() => {}} />,
    );
    expect(screen.getByText("暂无审校数据")).toBeDefined();
  });

  it("renders chapter list with titles", () => {
    render(
      <ChapterReviewSelector reviews={mockReviews} loading={false} selectedChapter={null} onSelect={() => {}} />,
    );
    expect(screen.getByText("起源")).toBeDefined();
    expect(screen.getByText("征途")).toBeDefined();
    expect(screen.getByText("第3章")).toBeDefined();
  });

  it("renders scores with correct color coding", () => {
    render(
      <ChapterReviewSelector reviews={mockReviews} loading={false} selectedChapter={null} onSelect={() => {}} />,
    );
    expect(screen.getByText("88分")).toBeDefined();
    expect(screen.getByText("62分")).toBeDefined();
  });

  it("renders status badges", () => {
    render(
      <ChapterReviewSelector reviews={mockReviews} loading={false} selectedChapter={null} onSelect={() => {}} />,
    );
    expect(screen.getByText("通过")).toBeDefined();
    expect(screen.getByText("未通过")).toBeDefined();
    expect(screen.getByText("待审")).toBeDefined();
  });

  it("shows round count when > 1", () => {
    render(
      <ChapterReviewSelector reviews={mockReviews} loading={false} selectedChapter={null} onSelect={() => {}} />,
    );
    expect(screen.getByText("2轮")).toBeDefined();
  });

  it("calls onSelect when chapter clicked", () => {
    let selected: number | null = null;
    render(
      <ChapterReviewSelector
        reviews={mockReviews}
        loading={false}
        selectedChapter={null}
        onSelect={(n) => { selected = n; }}
      />,
    );

    fireEvent.click(screen.getByText("起源"));
    expect(selected).toBe(1);
  });

  it("highlights selected chapter", () => {
    const { container } = render(
      <ChapterReviewSelector reviews={mockReviews} loading={false} selectedChapter={1} onSelect={() => {}} />,
    );
    const selected = container.querySelector(".bg-accent\\/80");
    expect(selected).toBeTruthy();
  });
});
