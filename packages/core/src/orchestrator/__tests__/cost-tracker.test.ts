import { describe, expect, it } from "vitest";
import { CostTracker } from "../cost-tracker.js";

describe("CostTracker", () => {
  describe("record / summarize", () => {
    it("records and summarizes costs correctly", () => {
      const tracker = new CostTracker();

      tracker.record("zhibi", "writing", 1000, 500, "claude-opus-4.6");
      tracker.record("mingjing", "reviewing", 800, 200, "gemini-3.1-pro");

      const summary = tracker.summarize(1);

      expect(summary.chapterNumber).toBe(1);
      expect(summary.totalInputTokens).toBe(1800);
      expect(summary.totalOutputTokens).toBe(700);
      expect(summary.totalEstimatedCost).toBeGreaterThan(0);
    });

    it("groups costs by agent", () => {
      const tracker = new CostTracker();

      tracker.record("zhibi", "writing", 1000, 500);
      tracker.record("zhibi", "writing", 500, 300);
      tracker.record("mingjing", "reviewing", 800, 200);

      const summary = tracker.summarize(1);

      expect(summary.byAgent["zhibi"]).toBeDefined();
      expect(summary.byAgent["zhibi"]?.inputTokens).toBe(1500);
      expect(summary.byAgent["zhibi"]?.outputTokens).toBe(800);
      expect(summary.byAgent["mingjing"]).toBeDefined();
    });

    it("groups costs by phase", () => {
      const tracker = new CostTracker();

      tracker.record("zhibi", "writing", 1000, 500);
      tracker.record("mingjing", "reviewing", 800, 200);

      const summary = tracker.summarize(1);

      expect(summary.byPhase["writing"]).toBeDefined();
      expect(summary.byPhase["reviewing"]).toBeDefined();
      expect(summary.byPhase["writing"]?.inputTokens).toBe(1000);
    });
  });

  describe("reset", () => {
    it("clears all recorded costs", () => {
      const tracker = new CostTracker();

      tracker.record("zhibi", "writing", 1000, 500);
      tracker.reset();

      const summary = tracker.summarize(1);
      expect(summary.totalInputTokens).toBe(0);
      expect(summary.totalOutputTokens).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("returns empty summary when no costs recorded", () => {
      const tracker = new CostTracker();
      const summary = tracker.summarize(1);

      expect(summary.chapterNumber).toBe(1);
      expect(summary.totalInputTokens).toBe(0);
      expect(summary.totalOutputTokens).toBe(0);
      expect(summary.totalEstimatedCost).toBe(0);
    });

    it("handles zero token costs", () => {
      const tracker = new CostTracker();
      tracker.record("zhibi", "writing", 0, 0);

      const summary = tracker.summarize(1);
      expect(summary.totalInputTokens).toBe(0);
      expect(summary.totalEstimatedCost).toBe(0);
    });
  });
});
