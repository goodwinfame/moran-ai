/**
 * Tests for TabBar component
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("idb-keyval", () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
}));

import { TabBar } from "@/components/panel/TabBar";
import { usePanelStore } from "@/stores/panel-store";

function resetStore() {
  usePanelStore.setState({
    activeTab: "brainstorm",
    visibleTabs: [],
    badges: {},
    lastUserActionTime: 0,
    brainstorm: null,
    world: null,
    characters: null,
    outline: null,
    foreshadows: null,
    timeline: null,
    chapters: null,
    reviews: null,
    analysis: null,
    externalAnalysis: null,
    knowledge: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

describe("TabBar", () => {
  it("renders nothing when no visible tabs", () => {
    const { container } = render(<TabBar />);
    expect(container.firstChild).toBeNull();
  });

  it("renders visible tabs", () => {
    usePanelStore.setState({ visibleTabs: ["brainstorm", "world"], activeTab: "brainstorm" });
    render(<TabBar />);
    expect(screen.getByTestId("tab-brainstorm")).toBeInTheDocument();
    expect(screen.getByTestId("tab-world")).toBeInTheDocument();
  });

  it("marks active tab with aria-selected=true", () => {
    usePanelStore.setState({ visibleTabs: ["brainstorm", "world"], activeTab: "world" });
    render(<TabBar />);
    expect(screen.getByTestId("tab-world")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("tab-brainstorm")).toHaveAttribute("aria-selected", "false");
  });

  it("switches active tab on click", () => {
    usePanelStore.setState({ visibleTabs: ["brainstorm", "world"], activeTab: "brainstorm" });
    render(<TabBar />);
    fireEvent.click(screen.getByTestId("tab-world"));
    expect(usePanelStore.getState().activeTab).toBe("world");
  });

  it("clears badge on tab click", () => {
    usePanelStore.setState({
      visibleTabs: ["brainstorm", "world"],
      activeTab: "brainstorm",
      badges: { world: { type: "dot" } },
    });
    render(<TabBar />);
    fireEvent.click(screen.getByTestId("tab-world"));
    expect(usePanelStore.getState().badges["world"]).toBeUndefined();
  });

  it("updates lastUserActionTime on tab click", () => {
    const before = Date.now();
    usePanelStore.setState({ visibleTabs: ["brainstorm", "world"], activeTab: "brainstorm" });
    render(<TabBar />);
    fireEvent.click(screen.getByTestId("tab-world"));
    expect(usePanelStore.getState().lastUserActionTime).toBeGreaterThanOrEqual(before);
  });

  it("shows count badge value", () => {
    usePanelStore.setState({
      visibleTabs: ["knowledge"],
      activeTab: "knowledge",
      badges: { knowledge: { type: "count", value: 5 } },
    });
    render(<TabBar />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows 99+ for count badges over 99", () => {
    usePanelStore.setState({
      visibleTabs: ["knowledge"],
      activeTab: "knowledge",
      badges: { knowledge: { type: "count", value: 100 } },
    });
    render(<TabBar />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("uses correct Chinese labels", () => {
    usePanelStore.setState({
      visibleTabs: ["brainstorm", "world", "character", "outline", "chapter", "review", "analysis", "knowledge"],
      activeTab: "brainstorm",
    });
    render(<TabBar />);
    expect(screen.getByText("脑暴")).toBeInTheDocument();
    expect(screen.getByText("设定")).toBeInTheDocument();
    expect(screen.getByText("角色")).toBeInTheDocument();
    expect(screen.getByText("大纲")).toBeInTheDocument();
    expect(screen.getByText("章节")).toBeInTheDocument();
    expect(screen.getByText("审校")).toBeInTheDocument();
    expect(screen.getByText("分析")).toBeInTheDocument();
    expect(screen.getByText("知识库")).toBeInTheDocument();
  });
});
