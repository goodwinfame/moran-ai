import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as React from "react";
import { ExportDialog } from "../../../components/settings/ExportDialog";

describe("ExportDialog", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("export button closes dialog", () => {
    render(<ExportDialog open={true} onClose={onClose} projectId="test-project" />);
    const exportBtn = screen.getByRole("button", { name: /开始导出/i });
    fireEvent.click(exportBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
