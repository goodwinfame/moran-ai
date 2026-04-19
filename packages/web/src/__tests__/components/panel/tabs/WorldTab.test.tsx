import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorldTab } from "@/components/panel/tabs/WorldTab";
import { usePanelStore } from "@/stores/panel-store";

vi.mock("@/stores/panel-store", () => ({
  usePanelStore: vi.fn(),
}));

vi.mock("@/components/panel/shared/SearchInput", () => ({
  SearchInput: ({ value, onChange, placeholder }: any) => (
    <input
      data-testid="search-input"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/panel/shared/CardGrid", () => ({
  CardGrid: ({ items, onCardClick, renderCard }: any) => (
    <div data-testid="card-grid">
      {items.map((item: any) => (
        <div
          key={item.id}
          data-testid={`card-${item.id}`}
          onClick={() => onCardClick(item.id)}
        >
          {renderCard ? renderCard(item) : item.name}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/panel/shared/TabEmptyState", () => ({
  TabEmptyState: ({ text }: any) => <div data-testid="empty-state">{text}</div>,
}));

vi.mock("@/components/panel/tabs/WorldDetailPage", () => ({
  WorldDetailPage: ({ subsystemId, onBack }: any) => (
    <div data-testid="world-detail-page">
      Detail {subsystemId}
      <button onClick={onBack}>Back</button>
    </div>
  ),
}));

describe("WorldTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state", () => {
    (usePanelStore as any).mockReturnValue(null);
    render(<WorldTab projectId="proj-1" />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("renders categories and filters by search", () => {
    const mockData = {
      categories: ["Cat A", "Cat B"],
      subsystems: [
        {
          id: "1",
          name: "Magic",
          icon: "🔮",
          category: "Cat A",
          summary: "Uses mana",
          entryCount: 10,
          hasNewContent: false,
        },
        {
          id: "2",
          name: "Tech",
          icon: "⚙️",
          category: "Cat B",
          summary: "Uses energy",
          entryCount: 5,
          hasNewContent: true,
        },
      ],
    };
    (usePanelStore as any).mockReturnValue(mockData);

    render(<WorldTab projectId="proj-1" />);

    expect(screen.getAllByText("Cat A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cat B").length).toBeGreaterThan(0);
    
    // Both cards rendered
    expect(screen.getByTestId("card-1")).toBeInTheDocument();
    expect(screen.getByTestId("card-2")).toBeInTheDocument();

    // Filter by search
    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "Tech" } });
    expect(screen.queryByTestId("card-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-2")).toBeInTheDocument();
  });

  it("handles card click and goes back", () => {
    const mockData = {
      categories: ["Cat A"],
      subsystems: [
        {
          id: "1",
          name: "Magic",
          icon: "🔮",
          category: "Cat A",
          summary: "Uses mana",
          entryCount: 10,
          hasNewContent: false,
        },
      ],
    };
    (usePanelStore as any).mockReturnValue(mockData);

    render(<WorldTab projectId="proj-1" />);

    fireEvent.click(screen.getByTestId("card-1"));
    expect(screen.getByTestId("world-detail-page")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Back"));
    expect(screen.queryByTestId("world-detail-page")).not.toBeInTheDocument();
  });
});
