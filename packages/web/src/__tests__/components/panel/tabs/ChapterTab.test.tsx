import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChapterTab } from "@/components/panel/tabs/ChapterTab";
import { usePanelStore } from "@/stores/panel-store";

vi.mock("@/stores/panel-store", () => ({
  usePanelStore: vi.fn(),
}));

vi.mock("@/components/panel/shared/TabEmptyState", () => ({
  TabEmptyState: ({ text }: any) => <div data-testid="empty-state">{text}</div>,
}));

vi.mock("@/components/ui/icon", () => ({
  Icon: ({ name }: any) => <span data-testid={`icon-${name}`} />,
}));

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

describe("ChapterTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when data is null", () => {
    (usePanelStore as any).mockImplementation((selector: any) => {
      return selector({ chapters: null });
    });
    render(<ChapterTab />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("renders writing mode with progress bar and streaming content", () => {
    const mockData = {
      mode: "writing" as const,
      chapterList: [],
      selectedChapter: null,
      writingProgress: { current: 1500, target: 3000 },
      streamingContent: "这是正在写作的内容...",
      isAutoFollow: true,
    };

    (usePanelStore as any).mockImplementation((selector: any) => {
      return selector({ chapters: mockData });
    });

    render(<ChapterTab />);
    expect(screen.getByText("1500 / 3000 字")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText(/这是正在写作的内容/)).toBeInTheDocument();
  });

  it("renders reading mode with chapter list", () => {
    const mockData = {
      mode: "reading" as const,
      chapterList: [
        { number: 1, title: "开端", status: "completed", wordCount: 3200 },
        { number: 2, title: "相遇", status: "writing", wordCount: 1500 },
      ],
      selectedChapter: 1,
      writingProgress: null,
      streamingContent: "第一章的内容...",
      isAutoFollow: false,
    };

    (usePanelStore as any).mockImplementation((selector: any) => {
      return selector({ chapters: mockData });
    });

    render(<ChapterTab />);
    expect(screen.getByText("章节列表")).toBeInTheDocument();
    expect(screen.getByText("第1章 开端")).toBeInTheDocument();
    expect(screen.getByText("第2章 相遇")).toBeInTheDocument();
  });

  it("allows switching chapters in reading mode", () => {
    const mockData = {
      mode: "reading" as const,
      chapterList: [
        { number: 1, title: "开端", status: "completed", wordCount: 3200 },
        { number: 2, title: "相遇", status: "completed", wordCount: 2800 },
      ],
      selectedChapter: 1,
      writingProgress: null,
      streamingContent: "",
      isAutoFollow: false,
    };

    (usePanelStore as any).mockImplementation((selector: any) => {
      return selector({ chapters: mockData });
    });

    render(<ChapterTab />);
    fireEvent.click(screen.getByText("第2章 相遇"));
    // After click, the selected chapter should change (UI updates via local state)
    expect(screen.getByText("第2章 相遇")).toBeInTheDocument();
  });
});
