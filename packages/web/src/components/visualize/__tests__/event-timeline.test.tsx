import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventTimeline } from "@/components/visualize/event-timeline";

const mockUseTimeline = vi.fn();

vi.mock("@/hooks/use-timeline", () => ({
  useTimeline: (...args: unknown[]) => mockUseTimeline(...args),
}));

// Mock vis-timeline dynamic import
vi.mock("vis-timeline/standalone", () => ({
  Timeline: vi.fn().mockImplementation(() => ({ destroy: vi.fn() })),
}));

vi.mock("vis-data/standalone", () => ({
  DataSet: vi.fn().mockImplementation((data: unknown[]) => data),
}));

describe("EventTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows prompt when no projectId", () => {
    mockUseTimeline.mockReturnValue({
      items: [], groups: [], loading: false, error: null, refetch: vi.fn(),
    });
    render(<EventTimeline projectId={null} />);
    expect(screen.getByText("请先选择项目")).toBeDefined();
  });

  it("shows loading state", () => {
    mockUseTimeline.mockReturnValue({
      items: [], groups: [], loading: true, error: null, refetch: vi.fn(),
    });
    render(<EventTimeline projectId="p1" />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("shows error state", () => {
    mockUseTimeline.mockReturnValue({
      items: [], groups: [], loading: false, error: "超时", refetch: vi.fn(),
    });
    render(<EventTimeline projectId="p1" />);
    expect(screen.getByText("超时")).toBeDefined();
  });

  it("shows empty state when no data", () => {
    mockUseTimeline.mockReturnValue({
      items: [], groups: [], loading: false, error: null, refetch: vi.fn(),
    });
    render(<EventTimeline projectId="p1" />);
    expect(screen.getByText("暂无事件数据")).toBeDefined();
  });

  it("renders header with counts when data present", () => {
    mockUseTimeline.mockReturnValue({
      items: [
        { id: "e1", content: "开篇", title: "desc", group: "main", start: "2025-01-01", end: null, type: "point", className: "", chapterNumber: 1, significance: "major" },
        { id: "e2", content: "转折", title: "desc", group: "main", start: "2025-02-01", end: null, type: "point", className: "", chapterNumber: 5, significance: "turning_point" },
        { id: "e3", content: "日常", title: "desc", group: "sub", start: "2025-01-15", end: null, type: "point", className: "", chapterNumber: 3, significance: "minor" },
      ],
      groups: [{ id: "main", content: "主线", order: 1 }],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<EventTimeline projectId="p1" />);
    expect(screen.getByText("事件时间线")).toBeDefined();
    expect(screen.getByText("3 事件")).toBeDefined();
    expect(screen.getByText("1 重大")).toBeDefined();
    expect(screen.getByText("1 转折点")).toBeDefined();
  });

  it("renders legend with significance labels", () => {
    mockUseTimeline.mockReturnValue({
      items: [
        { id: "e1", content: "X", title: "", group: "g", start: "2025-01-01", end: null, type: "point", className: "", chapterNumber: 1, significance: "minor" },
      ],
      groups: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<EventTimeline projectId="p1" />);
    expect(screen.getByText("重大")).toBeDefined();
    expect(screen.getByText("次要")).toBeDefined();
    expect(screen.getByText("转折点")).toBeDefined();
  });
});
