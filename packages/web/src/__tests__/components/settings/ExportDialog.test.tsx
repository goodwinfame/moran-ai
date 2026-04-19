import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as React from "react";
import { ExportDialog } from "../../../components/settings/ExportDialog";

const mockApiPost = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { post: (...args: unknown[]) => mockApiPost(...args) },
}));

describe("ExportDialog", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: successful export
    mockApiPost.mockResolvedValue({
      data: { content: "chapter content", filename: "export.txt" },
    });
    // Stub browser download APIs
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("renders when open", () => {
    render(<ExportDialog open={true} onClose={onClose} projectId="test-project" />);
    expect(screen.getByText("导出项目")).toBeDefined();
    expect(screen.getByText("导出格式")).toBeDefined();
    expect(screen.getByText("导出范围")).toBeDefined();
    expect(screen.getByText("导出内容")).toBeDefined();
  });

  it("format options visible", () => {
    render(<ExportDialog open={true} onClose={onClose} projectId="test-project" />);
    expect(screen.getByText("纯文本 (TXT)")).toBeDefined();
    expect(screen.getByText("Markdown")).toBeDefined();
    expect(screen.getByText("Word (DOCX)")).toBeDefined();
    expect(screen.getByText("电子书 (EPUB)")).toBeDefined();
  });

  it("close button works", () => {
    render(<ExportDialog open={true} onClose={onClose} projectId="test-project" />);
    const cancelBtn = screen.getByRole("button", { name: /取消/i });
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("export button closes dialog", async () => {
    render(<ExportDialog open={true} onClose={onClose} projectId="test-project" />);
    const exportBtn = screen.getByRole("button", { name: /开始导出/i });
    fireEvent.click(exportBtn);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("export button calls API and triggers download", async () => {
    render(<ExportDialog open={true} onClose={onClose} projectId="proj-123" />);
    const exportBtn = screen.getByRole("button", { name: /开始导出/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        "/api/projects/proj-123/export",
        expect.objectContaining({ format: expect.any(String) }),
      );
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows error on API failure", async () => {
    mockApiPost.mockRejectedValue(new Error("Network error"));
    render(<ExportDialog open={true} onClose={onClose} projectId="proj-123" />);
    const exportBtn = screen.getByRole("button", { name: /开始导出/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(screen.getByText("导出失败，请重试")).toBeDefined();
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
