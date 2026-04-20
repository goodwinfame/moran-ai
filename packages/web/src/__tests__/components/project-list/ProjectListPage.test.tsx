import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectListPage } from "@/components/project-list/ProjectListPage";
import { useProjectListStore } from "@/stores/project-list-store";
import { useRouter } from "next/navigation";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/stores/project-list-store", () => ({
  useProjectListStore: vi.fn(),
}));

const mockProjects = [
  {
    id: "proj-1",
    title: "第一部小说",
    genre: "玄幻",
    status: "brainstorm",
    currentChapter: 1,
    chapterCount: 5,
    totalWordCount: 2000,
    updatedAt: new Date().toISOString(),
    isPinned: true,
  },
  {
    id: "proj-2",
    title: "第二部小说",
    genre: "科幻",
    status: "world",
    currentChapter: 0,
    chapterCount: 0,
    totalWordCount: 0,
    updatedAt: new Date().toISOString(),
    isPinned: false,
  },
];

describe("ProjectListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders header and footer", () => {
    (useRouter as any).mockReturnValue({ push: vi.fn() });
    (useProjectListStore as any).mockReturnValue({
      projects: [],
      isLoading: false,
      isSending: false,
      inlineMessages: [],
      fetchProjects: vi.fn(),
      createProject: vi.fn(),
      initSession: vi.fn(),
      sendInlineMessage: vi.fn(),
    });

    render(<ProjectListPage />);

    expect(screen.getByText("墨染 MoRan")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("告诉墨衡你想写什么故事...")).toBeInTheDocument();
  });

  it("shows empty state when no projects", () => {
    (useRouter as any).mockReturnValue({ push: vi.fn() });
    (useProjectListStore as any).mockReturnValue({
      projects: [],
      isLoading: false,
      isSending: false,
      inlineMessages: [],
      fetchProjects: vi.fn(),
      createProject: vi.fn(),
      initSession: vi.fn(),
      sendInlineMessage: vi.fn(),
    });

    render(<ProjectListPage />);
    expect(screen.getByText("还没有项目")).toBeInTheDocument();
  });

  it("shows project cards when projects exist", () => {
    (useRouter as any).mockReturnValue({ push: vi.fn() });
    (useProjectListStore as any).mockReturnValue({
      projects: mockProjects,
      isLoading: false,
      isSending: false,
      inlineMessages: [],
      fetchProjects: vi.fn(),
      createProject: vi.fn(),
      initSession: vi.fn(),
      sendInlineMessage: vi.fn(),
    });

    render(<ProjectListPage />);
    
    expect(screen.getByText("第一部小说")).toBeInTheDocument();
    expect(screen.getByText("玄幻")).toBeInTheDocument();
    expect(screen.getByText("第二部小说")).toBeInTheDocument();
    expect(screen.getByText("科幻")).toBeInTheDocument();
    expect(screen.queryByText("还没有项目")).not.toBeInTheDocument();
  });

  it("calls fetchProjects on mount", () => {
    (useRouter as any).mockReturnValue({ push: vi.fn() });
    const fetchProjectsMock = vi.fn();
    const initSessionMock = vi.fn();
    (useProjectListStore as any).mockReturnValue({
      projects: [],
      isLoading: false,
      isSending: false,
      inlineMessages: [],
      fetchProjects: fetchProjectsMock,
      createProject: vi.fn(),
      initSession: initSessionMock,
      sendInlineMessage: vi.fn(),
    });

    render(<ProjectListPage />);
    expect(fetchProjectsMock).toHaveBeenCalledTimes(1);
    expect(initSessionMock).toHaveBeenCalledTimes(1);
  });
});
