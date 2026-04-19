/**
 * Tests for ConfirmDialog component
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderDialog(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const defaults = {
    open: true,
    onOpenChange: vi.fn(),
    title: "确认操作",
    onConfirm: vi.fn(),
  };
  return render(<ConfirmDialog {...defaults} {...props} />);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("ConfirmDialog", () => {
  describe("rendering", () => {
    it("renders the title", () => {
      renderDialog({ title: "删除项目" });
      expect(screen.getByText("删除项目")).toBeInTheDocument();
    });

    it("renders the description when provided", () => {
      renderDialog({ description: "此操作无法撤销" });
      expect(screen.getByText("此操作无法撤销")).toBeInTheDocument();
    });

    it("does not render description element when not provided", () => {
      renderDialog({ description: undefined });
      expect(screen.queryByText("此操作无法撤销")).not.toBeInTheDocument();
    });

    it("renders default confirm label '确认'", () => {
      renderDialog();
      expect(screen.getByRole("button", { name: "确认" })).toBeInTheDocument();
    });

    it("renders default cancel label '取消'", () => {
      renderDialog();
      expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();
    });

    it("renders custom confirm label", () => {
      renderDialog({ confirmLabel: "删除" });
      expect(screen.getByRole("button", { name: "删除" })).toBeInTheDocument();
    });

    it("renders custom cancel label", () => {
      renderDialog({ cancelLabel: "放弃" });
      expect(screen.getByRole("button", { name: "放弃" })).toBeInTheDocument();
    });

    it("does not render when open=false", () => {
      renderDialog({ open: false });
      expect(screen.queryByText("确认操作")).not.toBeInTheDocument();
    });
  });

  describe("confirm button", () => {
    it("calls onConfirm when confirm button is clicked", () => {
      const onConfirm = vi.fn();
      renderDialog({ onConfirm });
      fireEvent.click(screen.getByRole("button", { name: "确认" }));
      expect(onConfirm).toHaveBeenCalledOnce();
    });

    it("calls onOpenChange(false) after confirm", () => {
      const onOpenChange = vi.fn();
      renderDialog({ onOpenChange });
      fireEvent.click(screen.getByRole("button", { name: "确认" }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("cancel button", () => {
    it("calls onCancel when cancel button is clicked", () => {
      const onCancel = vi.fn();
      renderDialog({ onCancel });
      fireEvent.click(screen.getByRole("button", { name: "取消" }));
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it("calls onOpenChange(false) after cancel", () => {
      const onOpenChange = vi.fn();
      renderDialog({ onOpenChange });
      fireEvent.click(screen.getByRole("button", { name: "取消" }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("does not throw when onCancel is not provided", () => {
      renderDialog({ onCancel: undefined });
      expect(() => fireEvent.click(screen.getByRole("button", { name: "取消" }))).not.toThrow();
    });
  });

  describe("requireInput mode", () => {
    it("shows an input field when requireInput is set", () => {
      renderDialog({ requireInput: "项目名称" });
      expect(screen.getByPlaceholderText("请输入 项目名称 以确认")).toBeInTheDocument();
    });

    it("confirm button is disabled when input is empty", () => {
      renderDialog({ requireInput: "项目名称" });
      const confirmBtn = screen.getByRole("button", { name: "确认" });
      expect(confirmBtn).toBeDisabled();
    });

    it("confirm button is disabled when input does not match", () => {
      renderDialog({ requireInput: "项目名称" });
      const input = screen.getByPlaceholderText("请输入 项目名称 以确认");
      fireEvent.change(input, { target: { value: "wrong" } });
      expect(screen.getByRole("button", { name: "确认" })).toBeDisabled();
    });

    it("confirm button is enabled when input matches exactly", () => {
      renderDialog({ requireInput: "项目名称" });
      const input = screen.getByPlaceholderText("请输入 项目名称 以确认");
      fireEvent.change(input, { target: { value: "项目名称" } });
      expect(screen.getByRole("button", { name: "确认" })).not.toBeDisabled();
    });

    it("does not call onConfirm when input does not match and button clicked", () => {
      const onConfirm = vi.fn();
      renderDialog({ requireInput: "correct", onConfirm });
      const input = screen.getByPlaceholderText("请输入 correct 以确认");
      fireEvent.change(input, { target: { value: "wrong" } });
      fireEvent.click(screen.getByRole("button", { name: "确认" }));
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("calls onConfirm when input matches and button clicked", () => {
      const onConfirm = vi.fn();
      renderDialog({ requireInput: "correct", onConfirm });
      const input = screen.getByPlaceholderText("请输入 correct 以确认");
      fireEvent.change(input, { target: { value: "correct" } });
      fireEvent.click(screen.getByRole("button", { name: "确认" }));
      expect(onConfirm).toHaveBeenCalledOnce();
    });
  });

  describe("destructive variant", () => {
    it("confirm button without destructive variant does not have destructive class", () => {
      renderDialog({ variant: "default" });
      const confirmBtn = screen.getByRole("button", { name: "确认" });
      // default variant should not have bg-destructive
      expect(confirmBtn).not.toHaveClass("bg-destructive");
    });

    it("confirm button with destructive variant has destructive styling", () => {
      renderDialog({ variant: "destructive", confirmLabel: "删除" });
      const confirmBtn = screen.getByRole("button", { name: "删除" });
      expect(confirmBtn).toHaveClass("bg-destructive");
    });
  });
});
