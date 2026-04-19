import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { QuestionPanel } from "@/components/chat/QuestionPanel";

describe("QuestionPanel", () => {
  const options = [
    { label: "Option 1", value: "opt1" },
    { label: "Option 2", value: "opt2" },
  ];

  it("renders all options", () => {
    const onSelect = vi.fn();
    const onFreeInput = vi.fn();
    render(
      <QuestionPanel
        question="What to do?"
        options={options}
        onSelect={onSelect}
        onFreeInput={onFreeInput}
      />
    );
    expect(screen.getByText("What to do?")).toBeDefined();
    expect(screen.getByText("Option 1")).toBeDefined();
    expect(screen.getByText("Option 2")).toBeDefined();
    expect(screen.getByText("自由输入")).toBeDefined();
  });

  it("click option calls onSelect", () => {
    const onSelect = vi.fn();
    const onFreeInput = vi.fn();
    render(
      <QuestionPanel
        question="What to do?"
        options={options}
        onSelect={onSelect}
        onFreeInput={onFreeInput}
      />
    );
    
    fireEvent.click(screen.getByText("Option 1"));
    expect(onSelect).toHaveBeenCalledWith("opt1");
  });

  it("free input button calls onFreeInput", () => {
    const onSelect = vi.fn();
    const onFreeInput = vi.fn();
    render(
      <QuestionPanel
        question="What to do?"
        options={options}
        onSelect={onSelect}
        onFreeInput={onFreeInput}
      />
    );
    
    fireEvent.click(screen.getByText("自由输入"));
    expect(onFreeInput).toHaveBeenCalled();
  });

  it("keyboard selection with number keys", () => {
    const onSelect = vi.fn();
    const onFreeInput = vi.fn();
    render(
      <QuestionPanel
        question="What to do?"
        options={options}
        onSelect={onSelect}
        onFreeInput={onFreeInput}
      />
    );
    
    fireEvent.keyDown(window, { key: "1" });
    expect(onSelect).toHaveBeenCalledWith("opt1");
    
    fireEvent.keyDown(window, { key: "2" });
    expect(onSelect).toHaveBeenCalledWith("opt2");
    
    fireEvent.keyDown(window, { key: "3" });
    // Doesn't match option, no call
    expect(onSelect).toHaveBeenCalledTimes(2);
  });
});
