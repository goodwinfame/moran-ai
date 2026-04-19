/**
 * Tests for MobileTabBar component
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock idb-keyval (used by panel-store via InfoPanel)
vi.mock("idb-keyval", () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
}));

import { MobileTabBar } from "@/components/workspace/MobileTabBar";

describe("MobileTabBar", () => {
  it("renders two tabs: 聊天 and 面板", () => {
    render(<MobileTabBar projectId="test-proj" />);
    expect(screen.getByText("聊天")).toBeInTheDocument();
    expect(screen.getByText("面板")).toBeInTheDocument();
  });

  it("renders the tab bar element", () => {
    render(<MobileTabBar projectId="test-proj" />);
    expect(screen.getByTestId("mobile-tab-bar")).toBeInTheDocument();
  });

  it("chat tab is active by default", () => {
    render(<MobileTabBar projectId="test-proj" />);
    const chatTab = screen.getByTestId("tab-chat");
    expect(chatTab).toHaveAttribute("aria-selected", "true");
  });

  it("panel tab is not active by default", () => {
    render(<MobileTabBar projectId="test-proj" />);
    const panelTab = screen.getByTestId("tab-panel");
    expect(panelTab).toHaveAttribute("aria-selected", "false");
  });

  it("shows chat content area by default", () => {
    render(<MobileTabBar projectId="test-proj" />);
    expect(screen.getByTestId("mobile-chat-content")).toBeInTheDocument();
  });

  it("does not show panel content area by default", () => {
    render(<MobileTabBar projectId="test-proj" />);
    expect(screen.queryByTestId("mobile-panel-content")).not.toBeInTheDocument();
  });

  it("clicking 面板 tab switches to panel content", () => {
    render(<MobileTabBar projectId="test-proj" />);
    fireEvent.click(screen.getByTestId("tab-panel"));
    expect(screen.getByTestId("mobile-panel-content")).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-chat-content")).not.toBeInTheDocument();
  });

  it("clicking 面板 sets panel tab as active", () => {
    render(<MobileTabBar projectId="test-proj" />);
    fireEvent.click(screen.getByTestId("tab-panel"));
    expect(screen.getByTestId("tab-panel")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("tab-chat")).toHaveAttribute("aria-selected", "false");
  });

  it("clicking 聊天 tab after switching back shows chat content", () => {
    render(<MobileTabBar projectId="test-proj" />);
    fireEvent.click(screen.getByTestId("tab-panel"));
    fireEvent.click(screen.getByTestId("tab-chat"));
    expect(screen.getByTestId("mobile-chat-content")).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-panel-content")).not.toBeInTheDocument();
  });

  it("chat tab has role=tab", () => {
    render(<MobileTabBar projectId="test-proj" />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
  });

  it("accepts any projectId prop without errors", () => {
    expect(() =>
      render(<MobileTabBar projectId="some-project-id-123" />),
    ).not.toThrow();
  });
});
