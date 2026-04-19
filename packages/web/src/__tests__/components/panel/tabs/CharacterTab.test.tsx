import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CharacterTab } from "@/components/panel/tabs/CharacterTab";
import { usePanelStore } from "@/stores/panel-store";

vi.mock("@/stores/panel-store", () => ({
  usePanelStore: vi.fn(),
}));

vi.mock("@/components/panel/shared/CollapsibleSection", () => ({
  CollapsibleSection: ({ title, children, defaultOpen }: any) => (
    <div data-testid={`collapsible-${title}`}>
      <div data-testid={`title-${title}`}>{title}</div>
      {defaultOpen || true ? children : null}
    </div>
  ),
}));

vi.mock("@/components/panel/shared/TabEmptyState", () => ({
  TabEmptyState: ({ text }: any) => <div data-testid="empty-state">{text}</div>,
}));

vi.mock("@/components/panel/tabs/CharacterDetail", () => ({
  CharacterDetail: ({ character }: any) => <div data-testid={`detail-${character.id}`}>Detail: {character.name}</div>,
}));

vi.mock("@/components/panel/tabs/RelationshipGraph", () => ({
  RelationshipGraph: () => <div data-testid="relationship-graph">Graph</div>,
}));

describe("CharacterTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state", () => {
    (usePanelStore as any).mockReturnValue({ characters: [] });
    render(<CharacterTab projectId="proj-1" />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("renders grouped characters and filters by role", () => {
    const mockData = {
      characters: [
        { id: "1", name: "Hero", role: "protagonist", designTier: "核心层" },
        { id: "2", name: "Sidekick", role: "supporting", designTier: "重要层" },
        { id: "3", name: "Extra", role: "minor", designTier: "点缀层" },
      ],
    };
    (usePanelStore as any).mockReturnValue(mockData);

    render(<CharacterTab projectId="proj-1" />);

    expect(screen.getByTestId("collapsible-核心层")).toBeInTheDocument();
    expect(screen.getByText("Hero")).toBeInTheDocument();
    
    expect(screen.getByTestId("collapsible-重要层")).toBeInTheDocument();
    expect(screen.getByText("Sidekick")).toBeInTheDocument();

    expect(screen.getByTestId("collapsible-点缀层")).toBeInTheDocument();
    expect(screen.getByText("Extra")).toBeInTheDocument();

    expect(screen.getByTestId("relationship-graph")).toBeInTheDocument();

    // Filter by role — "主角" appears both as filter button and character badge
    fireEvent.click(screen.getAllByText("主角")[0]!);
    expect(screen.getByText("Hero")).toBeInTheDocument();
    expect(screen.queryByText("Sidekick")).not.toBeInTheDocument();
    expect(screen.queryByText("Extra")).not.toBeInTheDocument();
  });

  it("expands core tier details", () => {
    const mockData = {
      characters: [
        { id: "1", name: "Hero", role: "protagonist", designTier: "核心层" },
      ],
    };
    (usePanelStore as any).mockReturnValue(mockData);

    render(<CharacterTab projectId="proj-1" />);
    
    const expandBtn = screen.getByText("查看详情");
    fireEvent.click(expandBtn);
    expect(screen.getByTestId("detail-1")).toBeInTheDocument();

    fireEvent.click(screen.getByText("收起详情"));
    expect(screen.queryByTestId("detail-1")).not.toBeInTheDocument();
  });
});
