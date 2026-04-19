import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OutlineTab } from "@/components/panel/tabs/OutlineTab";
import { usePanelStore } from "@/stores/panel-store";

vi.mock("@/stores/panel-store", () => ({
  usePanelStore: vi.fn(),
}));

vi.mock("@/components/panel/tabs/ForeshadowView", () => ({
  ForeshadowView: ({ data }: any) => (
    <div data-testid="foreshadow-view">{data.unresolved.length} unresolved</div>
  ),
}));

vi.mock("@/components/panel/tabs/TimelineView", () => ({
  TimelineView: ({ data }: any) => (
    <div data-testid="timeline-view">{data.events.length} events</div>
  ),
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

vi.mock("@/components/ui/icon", () => ({
  Icon: ({ name }: any) => <span data-testid={`icon-${name}`} />,
}));

describe("OutlineTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when all data is null", () => {
    (usePanelStore as any).mockImplementation(() => {
      // outline, foreshadows, timeline — all null
      return null;
    });
    render(<OutlineTab />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("renders outline view with arcs and chapters", () => {
    const mockOutline = {
      arcs: [
        {
          id: "arc-1",
          title: "第一卷：起始",
          chapterRange: "1-10",
          chapters: [
            { number: 1, title: "开端", status: "completed", brief: null },
            { number: 2, title: "相遇", status: "writing", brief: null },
          ],
        },
      ],
    };

    (usePanelStore as any).mockImplementation((selector: any) => {
      const state = { outline: mockOutline, foreshadows: null, timeline: null };
      return selector(state);
    });

    render(<OutlineTab />);
    expect(screen.getByText("大纲")).toBeInTheDocument();
    expect(screen.getByText("伏笔追踪")).toBeInTheDocument();
    expect(screen.getByText("时间线")).toBeInTheDocument();
    expect(screen.getByText("第一卷：起始")).toBeInTheDocument();
  });

  it("switches to foreshadow view", () => {
    const mockForeshadows = {
      unresolved: [{ id: "f1", description: "Foreshadow 1", plantedChapter: 1, characters: [] }],
      resolved: [],
      overdue: [],
    };

    (usePanelStore as any).mockImplementation((selector: any) => {
      const state = { outline: null, foreshadows: mockForeshadows, timeline: null };
      return selector(state);
    });

    render(<OutlineTab />);
    fireEvent.click(screen.getByText("伏笔追踪"));
    expect(screen.getByTestId("foreshadow-view")).toBeInTheDocument();
  });

  it("switches to timeline view", () => {
    const mockTimeline = {
      events: [{ id: "e1", storyTime: "Day 1", description: "Event 1", characters: [], chapterNumber: 1 }],
    };

    (usePanelStore as any).mockImplementation((selector: any) => {
      const state = { outline: null, foreshadows: null, timeline: mockTimeline };
      return selector(state);
    });

    render(<OutlineTab />);
    fireEvent.click(screen.getByText("时间线"));
    expect(screen.getByTestId("timeline-view")).toBeInTheDocument();
  });
});
