/**
 * Tests for InfoPanel component
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock idb-keyval
vi.mock("idb-keyval", () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
}));

// Mock lazy tab components — named exports for tabs that use named exports,
// default export for tabs that use default exports (analysis, knowledge).
vi.mock("@/components/panel/tabs/BrainstormTab", () => ({ BrainstormTab: () => <div data-testid="brainstorm-tab" /> }));
vi.mock("@/components/panel/tabs/WorldTab", () => ({ WorldTab: () => <div data-testid="world-tab" /> }));
vi.mock("@/components/panel/tabs/CharacterTab", () => ({ CharacterTab: () => <div data-testid="character-tab" /> }));
vi.mock("@/components/panel/tabs/OutlineTab", () => ({ OutlineTab: () => <div data-testid="outline-tab" /> }));
vi.mock("@/components/panel/tabs/ChapterTab", () => ({ ChapterTab: () => <div data-testid="chapter-tab" /> }));
vi.mock("@/components/panel/tabs/ReviewTab", () => ({ ReviewTab: () => <div data-testid="review-tab" /> }));
vi.mock("@/components/panel/tabs/AnalysisTab", () => ({ default: () => <div data-testid="analysis-tab" /> }));
vi.mock("@/components/panel/tabs/KnowledgeTab", () => ({ default: () => <div data-testid="knowledge-tab" /> }));

import { InfoPanel } from "@/components/panel/InfoPanel";
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

describe("InfoPanel", () => {
  it("renders the info-panel container", () => {
    render(<InfoPanel projectId="proj-1" />);
    expect(screen.getByTestId("info-panel")).toBeInTheDocument();
  });

  it("shows EmptyState when no tabs are visible", () => {
    render(<InfoPanel projectId="proj-1" />);
    // EmptyState contains the text about starting to create
    expect(screen.getByText(/开始创作后/)).toBeInTheDocument();
  });

  it("shows TabBar when tabs are visible", () => {
    usePanelStore.setState({ visibleTabs: ["brainstorm"], activeTab: "brainstorm" });
    render(<InfoPanel projectId="proj-1" />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("does not show EmptyState when tabs are visible", () => {
    usePanelStore.setState({ visibleTabs: ["brainstorm"], activeTab: "brainstorm" });
    render(<InfoPanel projectId="proj-1" />);
    expect(screen.queryByText(/开始创作后/)).not.toBeInTheDocument();
  });
});
