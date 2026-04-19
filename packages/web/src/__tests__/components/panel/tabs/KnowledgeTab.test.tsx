import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import KnowledgeTab from "@/components/panel/tabs/KnowledgeTab";
import { usePanelStore } from "@/stores/panel-store";

vi.mock("@/stores/panel-store", () => ({
  usePanelStore: vi.fn(),
}));

vi.mock("@/components/panel/shared/SearchInput", () => ({
  SearchInput: ({ value, onChange, placeholder }: any) => (
    <input
      data-testid="search-input"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/panel/shared/TabEmptyState", () => ({
  TabEmptyState: ({ text }: any) => <div data-testid="empty-state">{text}</div>,
}));

describe("KnowledgeTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when data is null", () => {
    (usePanelStore as any).mockImplementation((selector: any) => {
      return selector({ knowledge: null });
    });
    render(<KnowledgeTab projectId="proj-1" />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("renders entries and category filters", () => {
    const mockData = {
      entries: [
        {
          id: "k1",
          category: "writing_technique",
          title: "对话写作技巧",
          summary: "避免单调的说和问",
          source: "析典",
          scope: "project" as const,
        },
        {
          id: "k2",
          category: "lesson",
          title: "节奏把控",
          summary: "长段描写后加快节奏",
          source: "明镜",
          scope: "project" as const,
        },
      ],
      totalCount: 2,
      loadedCount: 2,
    };

    (usePanelStore as any).mockImplementation((selector: any) => {
      return selector({ knowledge: mockData });
    });

    render(<KnowledgeTab projectId="proj-1" />);
    expect(screen.getByText("对话写作技巧")).toBeInTheDocument();
    expect(screen.getByText("节奏把控")).toBeInTheDocument();
    expect(screen.getByText("全部")).toBeInTheDocument();
    expect(screen.getAllByText("写作技巧").length).toBeGreaterThan(0);
    expect(screen.getAllByText("经验教训").length).toBeGreaterThan(0);
  });

  it("filters by category", () => {
    const mockData = {
      entries: [
        { id: "k1", category: "writing_technique", title: "技巧条目", summary: "...", source: "析典", scope: "project" as const },
        { id: "k2", category: "lesson", title: "教训条目", summary: "...", source: "明镜", scope: "project" as const },
      ],
      totalCount: 2,
      loadedCount: 2,
    };

    (usePanelStore as any).mockImplementation((selector: any) => {
      return selector({ knowledge: mockData });
    });

    render(<KnowledgeTab projectId="proj-1" />);
    fireEvent.click(screen.getAllByText("写作技巧")[0]!);
    // After filtering, only writing_technique entries should show
    expect(screen.getByText("技巧条目")).toBeInTheDocument();
    expect(screen.queryByText("教训条目")).not.toBeInTheDocument();
  });

  it("expands entry on click", () => {
    const mockData = {
      entries: [
        {
          id: "k1",
          category: "writing_technique",
          title: "对话写作技巧",
          summary: "避免单调的说和问",
          source: "析典",
          scope: "project" as const,
          content: "详细的对话写作指南...",
          maintainer: "博闻",
          updatedAt: "2026-04-19",
        },
      ],
      totalCount: 1,
      loadedCount: 1,
    };

    (usePanelStore as any).mockImplementation((selector: any) => {
      return selector({ knowledge: mockData });
    });

    render(<KnowledgeTab projectId="proj-1" />);
    fireEvent.click(screen.getByText("对话写作技巧"));
    expect(screen.getByText("详细的对话写作指南...")).toBeInTheDocument();
    expect(screen.getByText("博闻")).toBeInTheDocument();
  });

  it("toggles scope between project and global", () => {
    const mockData = {
      entries: [
        { id: "k1", category: "lesson", title: "项目条目", summary: "...", source: "a", scope: "project" as const },
        { id: "k2", category: "lesson", title: "全局条目", summary: "...", source: "b", scope: "global" as const },
      ],
      totalCount: 2,
      loadedCount: 2,
    };

    (usePanelStore as any).mockImplementation((selector: any) => {
      return selector({ knowledge: mockData });
    });

    render(<KnowledgeTab projectId="proj-1" />);
    // Default scope is "project", so only project entries show
    expect(screen.getByText("项目条目")).toBeInTheDocument();
    expect(screen.queryByText("全局条目")).not.toBeInTheDocument();

    // Switch to global
    fireEvent.click(screen.getByText("全局"));
    // Global scope shows all entries
    expect(screen.getByText("项目条目")).toBeInTheDocument();
    expect(screen.getByText("全局条目")).toBeInTheDocument();
  });

  it("shows load more button when there are more entries", () => {
    const entries = Array.from({ length: 25 }, (_, i) => ({
      id: `k${i}`,
      category: "lesson",
      title: `条目 ${i + 1}`,
      summary: "...",
      source: "a",
      scope: "project" as const,
    }));

    const mockData = {
      entries,
      totalCount: 25,
      loadedCount: 25,
    };

    (usePanelStore as any).mockImplementation((selector: any) => {
      return selector({ knowledge: mockData });
    });

    render(<KnowledgeTab projectId="proj-1" />);
    expect(screen.getByText(/加载更多/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/加载更多/));
    // After loading more, all 25 should be visible
    expect(screen.getByText("条目 25")).toBeInTheDocument();
  });
});
