import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ProjectCard } from "@/components/project-list/ProjectCard";
import { ProjectItem } from "@/stores/project-list-store";
import { useRouter } from "next/navigation";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

const mockProject: ProjectItem = {
  id: "test-id",
  title: "Test Project",
  genre: "Sci-Fi",
  status: "writing",
  currentChapter: 3,
  chapterCount: 10,
  totalWordCount: 12500,
  updatedAt: new Date().toISOString(),
  isPinned: false,
};

describe("ProjectCard", () => {
  it("renders all card fields correctly", () => {
    (useRouter as any).mockReturnValue({ push: vi.fn() });
    const onContextMenu = vi.fn();

    render(<ProjectCard project={mockProject} onContextMenu={onContextMenu} />);

    expect(screen.getByText("Test Project")).toBeInTheDocument();
    expect(screen.getByText("Sci-Fi")).toBeInTheDocument();
    expect(screen.getByText("✍️ 写作中")).toBeInTheDocument();
    expect(screen.getByText("3/10章")).toBeInTheDocument();
    expect(screen.getByText("1.3万字")).toBeInTheDocument(); // totalWordCount > 10000 format
  });

  it("calls push when clicked", () => {
    const pushMock = vi.fn();
    (useRouter as any).mockReturnValue({ push: pushMock });

    render(<ProjectCard project={mockProject} onContextMenu={vi.fn()} />);

    const card = screen.getByText("Test Project").closest(".group");
    fireEvent.click(card!);

    expect(pushMock).toHaveBeenCalledWith("/projects/test-id");
  });

  it("calls onContextMenu with right click", () => {
    const pushMock = vi.fn();
    (useRouter as any).mockReturnValue({ push: pushMock });
    const contextMock = vi.fn();

    render(<ProjectCard project={mockProject} onContextMenu={contextMock} />);

    const card = screen.getByText("Test Project").closest(".group");
    fireEvent.contextMenu(card!);

    expect(contextMock).toHaveBeenCalledWith(expect.anything(), mockProject);
  });

  it("formats small word count correctly", () => {
    (useRouter as any).mockReturnValue({ push: vi.fn() });
    const smallCountProject = { ...mockProject, totalWordCount: 500 };
    render(<ProjectCard project={smallCountProject} onContextMenu={vi.fn()} />);
    expect(screen.getByText("500字")).toBeInTheDocument();
  });
});
