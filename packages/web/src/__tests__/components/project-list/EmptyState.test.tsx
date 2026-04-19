import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EmptyState } from "@/components/project-list/EmptyState";

describe("EmptyState", () => {
  it("renders heading and subtext", () => {
    render(<EmptyState onExampleClick={vi.fn()} />);
    expect(screen.getByText("还没有项目")).toBeInTheDocument();
    expect(screen.getByText("告诉墨衡你想写什么故事吧")).toBeInTheDocument();
  });

  it("renders examples and calls onExampleClick", () => {
    const onClick = vi.fn();
    render(<EmptyState onExampleClick={onClick} />);
    
    const firstExample = screen.getByText("我想写一本赛博朋克修仙小说");
    expect(firstExample).toBeInTheDocument();
    
    fireEvent.click(firstExample);
    expect(onClick).toHaveBeenCalledWith("我想写一本赛博朋克修仙小说");
  });
});
