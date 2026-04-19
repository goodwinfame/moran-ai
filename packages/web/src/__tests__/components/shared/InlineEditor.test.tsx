/**
 * Tests for InlineEditor component
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InlineEditor } from "@/components/shared/InlineEditor";

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderEditor(props: Partial<React.ComponentProps<typeof InlineEditor>> = {}) {
  const defaults = {
    value: "旧标题",
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };
  return render(<InlineEditor {...defaults} {...props} />);
}

function getInput(): HTMLInputElement {
  return screen.getByRole("textbox") as HTMLInputElement;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("InlineEditor", () => {
  describe("rendering", () => {
    it("renders an input with the initial value", () => {
      renderEditor({ value: "我的项目" });
      expect(getInput().value).toBe("我的项目");
    });

    it("applies custom className", () => {
      renderEditor({ className: "custom-class" });
      expect(getInput()).toHaveClass("custom-class");
    });

    it("shows placeholder when provided", () => {
      renderEditor({ placeholder: "输入项目名" });
      expect(screen.getByPlaceholderText("输入项目名")).toBeInTheDocument();
    });

    it("applies maxLength attribute", () => {
      renderEditor({ maxLength: 50 });
      expect(getInput()).toHaveAttribute("maxlength", "50");
    });
  });

  describe("auto-focus", () => {
    it("auto-focuses the input on mount", () => {
      renderEditor();
      expect(document.activeElement).toBe(getInput());
    });
  });

  describe("Enter key", () => {
    it("calls onSave with trimmed value on Enter when value changed", () => {
      const onSave = vi.fn();
      renderEditor({ value: "旧标题", onSave });
      const input = getInput();
      fireEvent.change(input, { target: { value: "  新标题  " } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onSave).toHaveBeenCalledWith("新标题");
    });

    it("calls onCancel on Enter when value unchanged", () => {
      const onCancel = vi.fn();
      const onSave = vi.fn();
      renderEditor({ value: "旧标题", onSave, onCancel });
      const input = getInput();
      // Value is unchanged
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onSave).not.toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it("calls onCancel on Enter when input is empty", () => {
      const onCancel = vi.fn();
      const onSave = vi.fn();
      renderEditor({ value: "旧标题", onSave, onCancel });
      const input = getInput();
      fireEvent.change(input, { target: { value: "" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onSave).not.toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it("calls onCancel on Enter when input is only whitespace", () => {
      const onCancel = vi.fn();
      const onSave = vi.fn();
      renderEditor({ value: "旧标题", onSave, onCancel });
      const input = getInput();
      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onSave).not.toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });

  describe("Escape key", () => {
    it("calls onCancel on Escape", () => {
      const onCancel = vi.fn();
      renderEditor({ onCancel });
      const input = getInput();
      fireEvent.change(input, { target: { value: "modified" } });
      fireEvent.keyDown(input, { key: "Escape" });
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it("does NOT call onSave on Escape", () => {
      const onSave = vi.fn();
      renderEditor({ onSave });
      const input = getInput();
      fireEvent.keyDown(input, { key: "Escape" });
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe("blur", () => {
    it("calls onSave on blur when value changed", () => {
      const onSave = vi.fn();
      renderEditor({ value: "旧标题", onSave });
      const input = getInput();
      fireEvent.change(input, { target: { value: "新标题" } });
      fireEvent.blur(input);
      expect(onSave).toHaveBeenCalledWith("新标题");
    });

    it("calls onCancel on blur when value unchanged", () => {
      const onCancel = vi.fn();
      const onSave = vi.fn();
      renderEditor({ value: "旧标题", onSave, onCancel });
      const input = getInput();
      // No change, just blur
      fireEvent.blur(input);
      expect(onSave).not.toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it("does NOT double-save when Enter is followed by blur", () => {
      const onSave = vi.fn();
      renderEditor({ value: "旧标题", onSave });
      const input = getInput();
      fireEvent.change(input, { target: { value: "新标题" } });
      fireEvent.keyDown(input, { key: "Enter" });
      fireEvent.blur(input);
      // onSave should be called exactly once
      expect(onSave).toHaveBeenCalledOnce();
    });

    it("does NOT double-cancel when Escape is followed by blur", () => {
      const onCancel = vi.fn();
      renderEditor({ onCancel });
      const input = getInput();
      fireEvent.keyDown(input, { key: "Escape" });
      fireEvent.blur(input);
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });

  describe("trimming", () => {
    it("trims whitespace before calling onSave via blur", () => {
      const onSave = vi.fn();
      renderEditor({ value: "旧标题", onSave });
      const input = getInput();
      fireEvent.change(input, { target: { value: "  新标题  " } });
      fireEvent.blur(input);
      expect(onSave).toHaveBeenCalledWith("新标题");
    });
  });
});
