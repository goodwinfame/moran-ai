import { describe, expect, it } from "vitest";

import { SpiralDetector } from "../spiral-detector.js";
import { createMockStore, makeSlice } from "./helpers.js";

describe("SpiralDetector", () => {
  it("review spiral detected when reviewCount > 3", () => {
    const detector = new SpiralDetector();
    const report = detector.detectReviewSpiral("ch-1", 4);

    expect(report).not.toBeNull();
    expect(report?.type).toBe("review");
    expect(report?.severity).toBe("critical");
  });

  it("review spiral not detected when reviewCount <= 3", () => {
    const detector = new SpiralDetector();
    const report = detector.detectReviewSpiral("ch-1", 3);

    expect(report).toBeNull();
  });

  it("inflation spiral detected when consecutiveTriggers >= 3", () => {
    const detector = new SpiralDetector();
    const report = detector.detectInflationSpiral("guidance", 3);

    expect(report).not.toBeNull();
    expect(report?.type).toBe("inflation");
  });

  it("inflation spiral not detected when consecutiveTriggers < 3", () => {
    const detector = new SpiralDetector();
    const report = detector.detectInflationSpiral("guidance", 2);

    expect(report).toBeNull();
  });

  it("contradiction spiral detected when contradictionCount > 2", () => {
    const detector = new SpiralDetector();
    const report = detector.detectContradictionSpiral("entity-1", 3);

    expect(report).not.toBeNull();
    expect(report?.type).toBe("contradiction");
    expect(report?.severity).toBe("critical");
  });

  it("contradiction spiral not detected when contradictionCount <= 2", () => {
    const detector = new SpiralDetector();
    const report = detector.detectContradictionSpiral("entity-1", 2);

    expect(report).toBeNull();
  });

  it("pressure report computes usage percentages", async () => {
    const store = createMockStore([
      makeSlice({ category: "guidance", tier: "hot", tokenCount: 1000 }),
      makeSlice({ category: "guidance", tier: "warm", tokenCount: 2500 }),
    ]);
    const detector = new SpiralDetector();

    const report = await detector.generatePressureReport("guidance", store, "proj-1");

    expect(report.hot.percentage).toBe(50);
    expect(report.warm.percentage).toBe(50);
    expect(report.triggerCount).toBe(0);
  });

  it("pressure report suggests actions at high usage", async () => {
    const store = createMockStore([
      makeSlice({ category: "guidance", tier: "hot", tokenCount: 1800 }),
      makeSlice({ category: "guidance", tier: "warm", tokenCount: 4500 }),
    ]);
    const detector = new SpiralDetector();

    const report = await detector.generatePressureReport("guidance", store, "proj-1");

    expect(report.rootCause).toContain("hot tier saturation");
    expect(report.rootCause).toContain("warm tier saturation");
    expect(report.suggestedActions.length).toBeGreaterThan(1);
    expect(report.triggerCount).toBe(0);
  });
});
