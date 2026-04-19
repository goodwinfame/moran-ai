/**
 * Tests for SearchInput shared component
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SearchInput } from "@/components/panel/shared/SearchInput";

describe("SearchInput", () => {
  it("renders with placeholder", () => {
    render(<SearchInput onSearch={vi.fn()} placeholder="搜索角色" />);
    expect(screen.getByPlaceholderText("搜索角色")).toBeInTheDocument();
  });

  it("uses default placeholder when not provided", () => {
    render(<SearchInput onSearch={vi.fn()} />);
    expect(screen.getByPlaceholderText("搜索…")).toBeInTheDocument();
  });

  it("calls onSearch after debounce when typing", async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(<SearchInput onSearch={onSearch} debounceMs={300} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "hello" } });
    expect(onSearch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onSearch).toHaveBeenCalledWith("hello");
    vi.useRealTimers();
  });

  it("shows clear button when input has value", () => {
    render(<SearchInput onSearch={vi.fn()} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "test" } });
    expect(screen.getByLabelText("清除搜索")).toBeInTheDocument();
  });

  it("clears input and calls onSearch('') on clear button click", () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(<SearchInput onSearch={onSearch} debounceMs={0} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "test" } });
    vi.advanceTimersByTime(0);
    fireEvent.click(screen.getByLabelText("清除搜索"));
    expect((input as HTMLInputElement).value).toBe("");
    expect(onSearch).toHaveBeenLastCalledWith("");
    vi.useRealTimers();
  });
});
