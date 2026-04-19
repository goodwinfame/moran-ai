/**
 * Tests for CollapsibleSection shared component
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CollapsibleSection } from "@/components/panel/shared/CollapsibleSection";

describe("CollapsibleSection", () => {
  it("renders title", () => {
    render(<CollapsibleSection title="Test Section"><p>content</p></CollapsibleSection>);
    expect(screen.getByText("Test Section")).toBeInTheDocument();
  });

  it("shows children by default (defaultOpen=true)", () => {
    render(<CollapsibleSection title="Section"><p>visible content</p></CollapsibleSection>);
    expect(screen.getByText("visible content")).toBeInTheDocument();
  });

  it("hides children when defaultOpen=false", () => {
    render(<CollapsibleSection title="Section" defaultOpen={false}><p>hidden content</p></CollapsibleSection>);
    expect(screen.queryByText("hidden content")).not.toBeInTheDocument();
  });

  it("toggles open/closed on header click", () => {
    render(<CollapsibleSection title="Toggle"><p>toggle content</p></CollapsibleSection>);
    const button = screen.getByRole("button");
    // Initially open
    expect(screen.getByText("toggle content")).toBeInTheDocument();
    // Click to close
    fireEvent.click(button);
    expect(screen.queryByText("toggle content")).not.toBeInTheDocument();
    // Click to open again
    fireEvent.click(button);
    expect(screen.getByText("toggle content")).toBeInTheDocument();
  });

  it("sets aria-expanded correctly", () => {
    render(<CollapsibleSection title="Section"><p>content</p></CollapsibleSection>);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});
