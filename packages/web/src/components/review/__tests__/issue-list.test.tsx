import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IssueList, type ReviewIssueData } from "@/components/review/issue-list";

const mockIssues: ReviewIssueData[] = [
  {
    id: "issue-1",
    severity: "CRITICAL",
    category: "逻辑一致性",
    message: "左臂受伤却用左手持剑",
    evidence: "张三左手猛地拔出长剑",
    suggestion: "改为右手",
    verdict: "pending",
  },
  {
    id: "issue-2",
    severity: "MAJOR",
    category: "AI痕迹",
    message: "不禁感叹属于AI高频用语",
    verdict: "pending",
  },
  {
    id: "issue-3",
    severity: "MINOR",
    category: "文风",
    message: "句式重复",
    verdict: "accept",
  },
  {
    id: "issue-4",
    severity: "SUGGESTION",
    category: "伏笔",
    message: "可以在此埋下伏笔",
    suggestion: "暗示北方边境异动",
    verdict: "pending",
  },
];

describe("IssueList", () => {
  it("renders empty state when no issues", () => {
    render(<IssueList issues={[]} />);
    expect(screen.getByText("无审校问题")).toBeDefined();
  });

  it("renders severity summary badges", () => {
    render(<IssueList issues={mockIssues} />);
    expect(screen.getByText(/严重 1/)).toBeDefined();
    expect(screen.getByText(/重要 1/)).toBeDefined();
    expect(screen.getByText(/轻微 1/)).toBeDefined();
    expect(screen.getByText(/建议 1/)).toBeDefined();
  });

  it("renders issue messages", () => {
    render(<IssueList issues={mockIssues} />);
    expect(screen.getByText("左臂受伤却用左手持剑")).toBeDefined();
    expect(screen.getByText("不禁感叹属于AI高频用语")).toBeDefined();
    expect(screen.getByText("句式重复")).toBeDefined();
    expect(screen.getByText("可以在此埋下伏笔")).toBeDefined();
  });

  it("renders evidence when present", () => {
    render(<IssueList issues={mockIssues} />);
    expect(screen.getByText(/张三左手猛地拔出长剑/)).toBeDefined();
  });

  it("renders suggestions when present", () => {
    render(<IssueList issues={mockIssues} />);
    expect(screen.getByText(/改为右手/)).toBeDefined();
    expect(screen.getByText(/暗示北方边境异动/)).toBeDefined();
  });

  it("calls onVerdictChange when verdict button is clicked", () => {
    let calledWith: { id: string; verdict: string } | null = null;
    const onVerdictChange = (id: string, verdict: ReviewIssueData["verdict"]) => {
      calledWith = { id, verdict };
    };

    render(<IssueList issues={mockIssues} onVerdictChange={onVerdictChange} />);

    // Click "接受" button (first occurrence)
    const acceptButtons = screen.getAllByText("接受");
    const firstButton = acceptButtons[0];
    if (!firstButton) throw new Error("No accept button found");
    fireEvent.click(firstButton);
    expect(calledWith).toEqual({ id: "issue-1", verdict: "accept" });
  });

  it("calls onIssueClick when issue card is clicked", () => {
    let clickedId: string | null = null;
    render(
      <IssueList
        issues={mockIssues}
        onIssueClick={(id) => { clickedId = id; }}
      />,
    );

    fireEvent.click(screen.getByText("左臂受伤却用左手持剑"));
    expect(clickedId).toBe("issue-1");
  });

  it("applies opacity to accepted issues", () => {
    const accepted = mockIssues[0];
    const issues: ReviewIssueData[] = accepted
      ? [{ ...accepted, verdict: "accept" }]
      : [];
    const { container } = render(<IssueList issues={issues} />);
    const card = container.querySelector(".opacity-60");
    expect(card).toBeTruthy();
  });
});
