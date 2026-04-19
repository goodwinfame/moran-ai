import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as React from "react";
import { ProjectSettingsDrawer } from "../../../components/settings/ProjectSettingsDrawer";

describe("ProjectSettingsDrawer", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <ProjectSettingsDrawer projectId="test" open={false} onClose={onClose} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders when open", () => {
    render(<ProjectSettingsDrawer projectId="test" open={true} onClose={onClose} />);
    expect(screen.getByText("项目设置")).toBeDefined();
  });

  it("shows 6 sections", () => {
    render(<ProjectSettingsDrawer projectId="test" open={true} onClose={onClose} />);
    expect(screen.getByText("基本信息")).toBeDefined();
    expect(screen.getByText("写作风格")).toBeDefined();
    expect(screen.getByText("模型配置")).toBeDefined();
    expect(screen.getByText("成本预算")).toBeDefined();
    expect(screen.getByText("写作参数")).toBeDefined();
    expect(screen.getByText("危险操作")).toBeDefined();
  });

  it("close button calls onClose", () => {
    render(<ProjectSettingsDrawer projectId="test" open={true} onClose={onClose} />);
    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("escape key calls onClose", () => {
    render(<ProjectSettingsDrawer projectId="test" open={true} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
