import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewHistory, type ReviewHistoryEntry } from "@/components/review/review-history";

const mockEntries: ReviewHistoryEntry[] = [
  { round: 1, passed: false, score: 62, issueCount: 4, timestamp: "2026-04-14T10:00:00Z" },
  { round: 2, passed: false, score: 75, issueCount: 2, timestamp: "2026-04-14T11:00:00Z" },
  { round: 3, passed: true, score: 88, issueCount: 1, timestamp: "2026-04-14T12:00:00Z" },
];

describe("ReviewHistory", () => {
  it("renders nothing when no entries", () => {
    const { container } = render(<ReviewHistory entries={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders round labels", () => {
    render(<ReviewHistory entries={mockEntries} />);
    expect(screen.getByText("R1")).toBeDefined();
    expect(screen.getByText("R2")).toBeDefined();
    expect(screen.getByText("R3")).toBeDefined();
  });

  it("renders scores", () => {
    render(<ReviewHistory entries={mockEntries} />);
    expect(screen.getByText("62")).toBeDefined();
    expect(screen.getByText("75")).toBeDefined();
    expect(screen.getByText("88")).toBeDefined();
  });

  it("renders issue counts", () => {
    render(<ReviewHistory entries={mockEntries} />);
    expect(screen.getByText("(4)")).toBeDefined();
    expect(screen.getByText("(2)")).toBeDefined();
    expect(screen.getByText("(1)")).toBeDefined();
  });

  it("calls onRoundSelect when clicked", () => {
    let selected: number | null = null;
    render(
      <ReviewHistory
        entries={mockEntries}
        onRoundSelect={(i) => { selected = i; }}
      />,
    );

    fireEvent.click(screen.getByText("R2"));
    expect(selected).toBe(1); // index 1
  });

  it("highlights selected round", () => {
    const { container } = render(
      <ReviewHistory entries={mockEntries} selectedRound={2} />,
    );
    const buttons = container.querySelectorAll("button");
    // Third button (index 2) should have ring styling
    expect(buttons[2]?.className).toContain("ring-1");
  });
});
