import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResultPanel } from "@/components/alignment/result-panel";

describe("ResultPanel", () => {
  it("renders title", () => {
    render(<ResultPanel title="创作意图"><div>内容</div></ResultPanel>);
    expect(screen.getByText("创作意图")).toBeDefined();
  });

  it("renders children content", () => {
    render(<ResultPanel title="T"><span>子内容</span></ResultPanel>);
    expect(screen.getByText("子内容")).toBeDefined();
  });

  it("does not render CTA button when ctaText is absent", () => {
    render(<ResultPanel title="T"><div /></ResultPanel>);
    expect(screen.queryByRole("button", { name: /采用/ })).toBeNull();
  });

  it("renders CTA button when ctaText is provided", () => {
    render(<ResultPanel title="T" ctaText="采用此方案并继续"><div /></ResultPanel>);
    expect(screen.getByText("采用此方案并继续")).toBeDefined();
  });

  it("calls ctaAction when CTA button clicked", () => {
    const ctaAction = vi.fn();
    render(<ResultPanel title="T" ctaText="继续" ctaAction={ctaAction}><div /></ResultPanel>);
    fireEvent.click(screen.getByText("继续"));
    expect(ctaAction).toHaveBeenCalledOnce();
  });

  it("renders headerSlot when provided", () => {
    render(
      <ResultPanel title="T" headerSlot={<div>方案标签页</div>}>
        <div />
      </ResultPanel>
    );
    expect(screen.getByText("方案标签页")).toBeDefined();
  });

  it("does not render unexpected content when headerSlot is absent", () => {
    render(<ResultPanel title="T"><div>x</div></ResultPanel>);
    expect(screen.queryByText("方案标签页")).toBeNull();
  });
});