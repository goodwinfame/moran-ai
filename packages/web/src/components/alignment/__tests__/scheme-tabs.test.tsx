import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SchemeTabs } from "@/components/alignment/scheme-tabs";

describe("SchemeTabs", () => {
  const tabs = [
    { id: "1", label: "记忆碎片线" },
    { id: "2", label: "身份觉醒路" },
    { id: "3", label: "宿命对抗弧" },
  ];

  it("renders nothing when only one tab", () => {
    const { container } = render(
      <SchemeTabs tabs={[{ id: "1", label: "唯一方案" }]} activeId="1" onTabChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders all tabs when multiple exist", () => {
    render(<SchemeTabs tabs={tabs} activeId="1" onTabChange={vi.fn()} />);
    expect(screen.getByText("记忆碎片线")).toBeDefined();
    expect(screen.getByText("身份觉醒路")).toBeDefined();
    expect(screen.getByText("宿命对抗弧")).toBeDefined();
  });

  it("calls onTabChange with clicked tab id", () => {
    const onTabChange = vi.fn();
    render(<SchemeTabs tabs={tabs} activeId="1" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText("身份觉醒路"));
    expect(onTabChange).toHaveBeenCalledWith("2");
  });

  it("active tab has bold style class", () => {
    render(<SchemeTabs tabs={tabs} activeId="2" onTabChange={vi.fn()} />);
    const activeTab = screen.getByText("身份觉醒路").closest("div");
    expect(activeTab?.className).toContain("font-bold");
  });

  it("inactive tab does not have bold class", () => {
    render(<SchemeTabs tabs={tabs} activeId="1" onTabChange={vi.fn()} />);
    const inactiveTab = screen.getByText("身份觉醒路").closest("div");
    expect(inactiveTab?.className).not.toContain("font-bold");
  });

  it("calls onTabClose when close button clicked on active tab", () => {
    const onTabClose = vi.fn();
    render(<SchemeTabs tabs={tabs} activeId="1" onTabChange={vi.fn()} onTabClose={onTabClose} />);
    // Close button only appears on active tab
    const closeBtn = screen.getAllByRole("button")[0];
    fireEvent.click(closeBtn!);
    expect(onTabClose).toHaveBeenCalledWith("1");
  });

  it("close click does not propagate to onTabChange", () => {
    const onTabChange = vi.fn();
    const onTabClose = vi.fn();
    render(<SchemeTabs tabs={tabs} activeId="1" onTabChange={onTabChange} onTabClose={onTabClose} />);
    const closeBtn = screen.getAllByRole("button")[0];
    fireEvent.click(closeBtn!);
    expect(onTabChange).not.toHaveBeenCalled();
  });
});