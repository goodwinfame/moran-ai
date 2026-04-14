import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewReport, type ReviewRoundData } from "@/components/review/review-report";

const mockRounds: ReviewRoundData[] = [
  {
    round: 1,
    passed: false,
    score: 72,
    issues: [
      {
        id: "i1",
        severity: "CRITICAL",
        category: "逻辑",
        message: "角色矛盾",
        verdict: "pending",
      },
      {
        id: "i2",
        severity: "MAJOR",
        category: "AI痕迹",
        message: "AI高频用语",
        verdict: "pending",
      },
    ],
    timestamp: "2026-04-14T10:00:00Z",
  },
  {
    round: 2,
    passed: true,
    score: 88,
    issues: [
      {
        id: "i3",
        severity: "MINOR",
        category: "文风",
        message: "段落过渡生硬",
        verdict: "pending",
      },
    ],
    timestamp: "2026-04-14T11:00:00Z",
  },
];

describe("ReviewReport", () => {
  const noop = () => {};

  it("renders chapter header", () => {
    render(
      <ReviewReport
        chapterNumber={5}
        chapterTitle="风云变"
        rounds={mockRounds}
        status="passed"
        latestScore={88}
      />,
    );
    expect(screen.getByText("第5章")).toBeDefined();
    expect(screen.getByText("风云变")).toBeDefined();
  });

  it("renders passed status", () => {
    render(
      <ReviewReport chapterNumber={1} chapterTitle={null} rounds={mockRounds} status="passed" latestScore={88} />,
    );
    expect(screen.getByText("审校通过")).toBeDefined();
    expect(screen.getByText("88分")).toBeDefined();
  });

  it("renders failed status", () => {
    render(
      <ReviewReport chapterNumber={1} chapterTitle={null} rounds={mockRounds} status="failed" latestScore={72} />,
    );
    expect(screen.getByText("审校未通过")).toBeDefined();
  });

  it("renders round tabs", () => {
    render(
      <ReviewReport chapterNumber={1} chapterTitle={null} rounds={mockRounds} status="passed" latestScore={88} />,
    );
    expect(screen.getByText("第1轮")).toBeDefined();
    expect(screen.getByText("第2轮")).toBeDefined();
  });

  it("calls onRoundSelect when tab clicked", () => {
    let selected: number | null = null;
    render(
      <ReviewReport
        chapterNumber={1}
        chapterTitle={null}
        rounds={mockRounds}
        status="passed"
        latestScore={88}
        onRoundSelect={(i) => { selected = i; }}
      />,
    );

    fireEvent.click(screen.getByText("第1轮"));
    expect(selected).toBe(0);
  });

  it("shows issues for selected round", () => {
    render(
      <ReviewReport
        chapterNumber={1}
        chapterTitle={null}
        rounds={mockRounds}
        status="passed"
        latestScore={88}
        selectedRound={0}
      />,
    );
    expect(screen.getByText("角色矛盾")).toBeDefined();
    expect(screen.getByText("AI高频用语")).toBeDefined();
  });

  it("renders action buttons", () => {
    render(
      <ReviewReport
        chapterNumber={1}
        chapterTitle={null}
        rounds={mockRounds}
        status="failed"
        latestScore={72}
        onTriggerReview={noop}
        onForcePass={noop}
      />,
    );
    expect(screen.getByText("重新审校")).toBeDefined();
    expect(screen.getByText("强制通过")).toBeDefined();
  });

  it("hides force-pass when already passed", () => {
    render(
      <ReviewReport
        chapterNumber={1}
        chapterTitle={null}
        rounds={mockRounds}
        status="passed"
        latestScore={88}
        onTriggerReview={noop}
        onForcePass={noop}
      />,
    );
    expect(screen.getByText("重新审校")).toBeDefined();
    expect(screen.queryByText("强制通过")).toBeNull();
  });

  it("calls onTriggerReview when clicked", () => {
    let called = false;
    render(
      <ReviewReport
        chapterNumber={1}
        chapterTitle={null}
        rounds={mockRounds}
        status="failed"
        latestScore={72}
        onTriggerReview={() => { called = true; }}
      />,
    );

    fireEvent.click(screen.getByText("重新审校"));
    expect(called).toBe(true);
  });
});
