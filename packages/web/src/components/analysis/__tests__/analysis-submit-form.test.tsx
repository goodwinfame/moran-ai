import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnalysisSubmitForm } from "@/components/analysis/analysis-submit-form";

describe("AnalysisSubmitForm", () => {
  it("renders all form fields", () => {
    render(<AnalysisSubmitForm onSubmit={() => {}} />);
    expect(screen.getByLabelText(/作品名称/)).toBeDefined();
    expect(screen.getByLabelText(/作者名/)).toBeDefined();
    expect(screen.getByLabelText(/分析重点/)).toBeDefined();
    expect(screen.getByText("开始九维分析")).toBeDefined();
  });

  it("disables submit when workTitle is empty", () => {
    render(<AnalysisSubmitForm onSubmit={() => {}} />);
    const btn = screen.getByText("开始九维分析");
    expect(btn.closest("button")?.disabled).toBe(true);
  });

  it("enables submit when workTitle is filled", () => {
    render(<AnalysisSubmitForm onSubmit={() => {}} />);
    const input = screen.getByLabelText(/作品名称/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "大奉打更人" } });
    const btn = screen.getByText("开始九维分析");
    expect(btn.closest("button")?.disabled).toBe(false);
  });

  it("calls onSubmit with form data", () => {
    const onSubmit = vi.fn();
    render(<AnalysisSubmitForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/作品名称/), {
      target: { value: "大奉打更人" },
    });
    fireEvent.change(screen.getByLabelText(/作者名/), {
      target: { value: "卖报小郎君" },
    });
    fireEvent.click(screen.getByText("开始九维分析"));

    expect(onSubmit).toHaveBeenCalledWith({
      workTitle: "大奉打更人",
      authorName: "卖报小郎君",
      userNotes: undefined,
      providedTexts: undefined,
    });
  });

  it("shows loading state", () => {
    render(<AnalysisSubmitForm onSubmit={() => {}} loading />);
    expect(screen.getByText("分析中…")).toBeDefined();
  });

  it("adds and removes text snippets", () => {
    render(<AnalysisSubmitForm onSubmit={() => {}} />);

    // Type a snippet
    const textarea = screen.getByPlaceholderText(/粘贴作品文本片段/);
    fireEvent.change(textarea, { target: { value: "这是一段测试文本" } });

    // Click add snippet
    fireEvent.click(screen.getByText("添加片段"));

    // Should show the snippet
    expect(screen.getByText(/片段 1/)).toBeDefined();

    // Textarea should be cleared
    expect((textarea as HTMLTextAreaElement).value).toBe("");
  });
});
