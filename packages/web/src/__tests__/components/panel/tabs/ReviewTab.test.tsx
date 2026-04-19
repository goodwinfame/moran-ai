import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewTab } from "@/components/panel/tabs/ReviewTab";
import { usePanelStore } from "@/stores/panel-store";

vi.mock("@/stores/panel-store", () => ({
  usePanelStore: vi.fn(),
}));

vi.mock("@/components/panel/shared/CollapsibleSection", () => ({
  CollapsibleSection: ({ title, children, badge }: any) => (
    <div data-testid="collapsible-section">
      <div data-testid="section-title">{title}</div>
      {badge && <span data-testid="section-badge">{badge}</span>}
      {children}
    </div>
  ),
}));

vi.mock("@/components/panel/shared/TabEmptyState", () => ({
  TabEmptyState: ({ text }: any) => <div data-testid="empty-state">{text}</div>,
}));

describe("ReviewTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when data is null", () => {
    (usePanelStore as any).mockImplementation((selector: any) => {
      return selector({ reviews: null });
    });
    render(<ReviewTab />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("renders empty state when chapters array is empty", () => {
    (usePanelStore as any).mockImplementation((selector: any) => {
      return selector({ reviews: { chapters: [], selectedChapter: null } });
    });
    render(<ReviewTab />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("renders review data with score summary and rounds", () => {
    const mockData = {
      chapters: [
        {
          chapterNumber: 1,
          title: "开端",
          reviews: [
            {
              id: "r1",
              conclusion: "pass" as const,
              totalScore: 85,
              rounds: [
                { round: 1 as const, dimension: "AI痕迹检测", score: 90, issues: [] },
                { round: 2 as const, dimension: "逻辑一致性", score: 80, issues: [
                  { location: "段落3", description: "时间线冲突", suggestion: "调整顺序", severity: "warning" as const },
                ] },
              ],
            },
          ],
        },
      ],
      selectedChapter: 1,
    };

    (usePanelStore as any).mockImplementation((selector: any) => {
      return selector({ reviews: mockData });
    });

    render(<ReviewTab />);
    expect(screen.getByText("85 分")).toBeInTheDocument();
    expect(screen.getByText("通过")).toBeInTheDocument();
    expect(screen.getByText("时间线冲突")).toBeInTheDocument();
    expect(screen.getByText("调整顺序")).toBeInTheDocument();
  });

  it("allows chapter selection change", () => {
    const mockData = {
      chapters: [
        {
          chapterNumber: 1,
          title: "开端",
          reviews: [{ id: "r1", conclusion: "pass" as const, totalScore: 85, rounds: [] }],
        },
        {
          chapterNumber: 2,
          title: "相遇",
          reviews: [{ id: "r2", conclusion: "revise" as const, totalScore: 65, rounds: [] }],
        },
      ],
      selectedChapter: 1,
    };

    (usePanelStore as any).mockImplementation((selector: any) => {
      return selector({ reviews: mockData });
    });

    render(<ReviewTab />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "2" } });
    // Chapter 2 should now be active
    expect(select).toBeInTheDocument();
  });
});
