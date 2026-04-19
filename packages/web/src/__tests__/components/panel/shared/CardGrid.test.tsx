/**
 * Tests for CardGrid shared component
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { CardGrid } from "@/components/panel/shared/CardGrid";

// Mock ResizeObserver
beforeAll(() => {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
  }));
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe("CardGrid", () => {
  it("renders children", () => {
    render(
      <CardGrid>
        <div data-testid="card-1">Card 1</div>
        <div data-testid="card-2">Card 2</div>
      </CardGrid>,
    );
    expect(screen.getByTestId("card-1")).toBeInTheDocument();
    expect(screen.getByTestId("card-2")).toBeInTheDocument();
  });

  it("renders as a grid container", () => {
    const { container } = render(<CardGrid><div>item</div></CardGrid>);
    const grid = container.firstChild as HTMLElement;
    expect(grid.className).toContain("grid");
  });

  it("applies custom className", () => {
    const { container } = render(<CardGrid className="custom-class"><div>item</div></CardGrid>);
    expect((container.firstChild as HTMLElement).className).toContain("custom-class");
  });
});
