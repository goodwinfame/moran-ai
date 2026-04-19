import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RelationshipGraph } from "@/components/panel/tabs/RelationshipGraph";

// Mock next/dynamic
vi.mock("next/dynamic", () => ({
  default: () => {
    return function MockDynamicComponent() {
      return <div data-testid="dynamic-relationship-graph">Graph Inner</div>;
    };
  },
}));

describe("RelationshipGraph", () => {
  it("renders without crashing", () => {
    const characters = [
      {
        id: "1",
        name: "Hero",
        role: "protagonist",
        designTier: "核心层" as const,
        relationships: "Sidekick is a friend",
      },
      {
        id: "2",
        name: "Sidekick",
        role: "supporting",
        designTier: "重要层" as const,
      },
    ];

    render(<RelationshipGraph characters={characters} />);
    expect(screen.getByTestId("dynamic-relationship-graph")).toBeInTheDocument();
  });
});
