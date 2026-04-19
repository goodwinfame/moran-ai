/**
 * Tests for ResizableSplitter component
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ResizableSplitter } from "@/components/workspace/ResizableSplitter";

describe("ResizableSplitter", () => {
  it("renders the splitter element", () => {
    render(<ResizableSplitter onMouseDown={vi.fn()} onDoubleClick={vi.fn()} />);
    expect(screen.getByTestId("resizable-splitter")).toBeInTheDocument();
  });

  it("has cursor-col-resize class", () => {
    render(<ResizableSplitter onMouseDown={vi.fn()} onDoubleClick={vi.fn()} />);
    const splitter = screen.getByTestId("resizable-splitter");
    expect(splitter).toHaveClass("cursor-col-resize");
  });

  it("has flex-shrink-0 class to prevent shrinking", () => {
    render(<ResizableSplitter onMouseDown={vi.fn()} onDoubleClick={vi.fn()} />);
    const splitter = screen.getByTestId("resizable-splitter");
    expect(splitter).toHaveClass("flex-shrink-0");
  });

  it("calls onMouseDown when mouse is pressed", () => {
    const onMouseDown = vi.fn();
    render(<ResizableSplitter onMouseDown={onMouseDown} onDoubleClick={vi.fn()} />);
    fireEvent.mouseDown(screen.getByTestId("resizable-splitter"));
    expect(onMouseDown).toHaveBeenCalledTimes(1);
  });

  it("calls onDoubleClick when double-clicked", () => {
    const onDoubleClick = vi.fn();
    render(<ResizableSplitter onMouseDown={vi.fn()} onDoubleClick={onDoubleClick} />);
    fireEvent.doubleClick(screen.getByTestId("resizable-splitter"));
    expect(onDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onDoubleClick on single click", () => {
    const onDoubleClick = vi.fn();
    render(<ResizableSplitter onMouseDown={vi.fn()} onDoubleClick={onDoubleClick} />);
    fireEvent.click(screen.getByTestId("resizable-splitter"));
    expect(onDoubleClick).not.toHaveBeenCalled();
  });

  it("onMouseDown and onDoubleClick are independent handlers", () => {
    const onMouseDown = vi.fn();
    const onDoubleClick = vi.fn();
    render(<ResizableSplitter onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} />);
    const splitter = screen.getByTestId("resizable-splitter");

    fireEvent.mouseDown(splitter);
    expect(onMouseDown).toHaveBeenCalledTimes(1);
    expect(onDoubleClick).not.toHaveBeenCalled();

    fireEvent.doubleClick(splitter);
    expect(onDoubleClick).toHaveBeenCalledTimes(1);
  });
});
