import { describe, expect, it, vi } from "vitest";
import { VersionSelector, DEFAULT_VERSION_SELECTOR_CONFIG } from "../version-selector.js";
import { StyleManager } from "../../style/style-manager.js";
import { SessionProjectBridge } from "../../bridge/bridge.js";
import { ReviewEngine } from "../../review/review-engine.js";
import type { VersionProgress, VersionSelectedInfo } from "../version-selector.js";

describe("VersionSelector", () => {
  const makeSelector = (opts?: {
    versionCount?: number;
    temperaturePerturbation?: number;
    parallel?: boolean;
    skipFullReview?: boolean;
    withReview?: boolean;
    onProgress?: (p: VersionProgress) => void;
    onSelected?: (i: VersionSelectedInfo) => void;
  }) => {
    const styleManager = new StyleManager();
    const bridge = new SessionProjectBridge();
    const reviewEngine = opts?.withReview
      ? new ReviewEngine({ enableConsistencyCheck: false, enableLiteraryCheck: false })
      : null;

    const selector = new VersionSelector(
      styleManager,
      bridge,
      reviewEngine,
      {
        versionCount: opts?.versionCount ?? 3,
        temperaturePerturbation: opts?.temperaturePerturbation ?? 0.08,
        parallel: opts?.parallel ?? false,
        skipFullReview: opts?.skipFullReview ?? true,
      },
      opts?.onProgress ?? null,
      opts?.onSelected ?? null,
    );

    return { selector, styleManager, bridge };
  };

  const defaultParams = {
    projectId: "proj-test",
    chapterNumber: 1,
    arcNumber: 1,
    chapterType: "normal" as const,
    styleId: "\u4E91\u58A8",
  };

  describe("constructor", () => {
    it("creates instance with default config", () => {
      const { selector } = makeSelector();
      expect(selector).toBeInstanceOf(VersionSelector);
    });

    it("clamps versionCount to minimum 2", () => {
      // Should not throw, just clamp
      const { selector } = makeSelector({ versionCount: 1 });
      expect(selector).toBeInstanceOf(VersionSelector);
    });

    it("clamps versionCount to maximum 5", () => {
      const { selector } = makeSelector({ versionCount: 10 });
      expect(selector).toBeInstanceOf(VersionSelector);
    });
  });

  describe("selectBest — serial mode (skipFullReview)", () => {
    it("generates N versions and returns best", async () => {
      const { selector } = makeSelector({ versionCount: 3, skipFullReview: true });

      const result = await selector.selectBest(defaultParams);

      expect(result.totalVersions).toBe(3);
      expect(result.candidates).toHaveLength(3);
      expect(result.selected).toBeDefined();
      expect(result.selected.versionIndex).toBeGreaterThanOrEqual(1);
      expect(result.selected.versionIndex).toBeLessThanOrEqual(3);
    });

    it("candidates are sorted by score descending", async () => {
      const { selector } = makeSelector({ versionCount: 3, skipFullReview: true });
      const result = await selector.selectBest(defaultParams);

      for (let i = 1; i < result.candidates.length; i++) {
        const prev = result.candidates[i - 1];
        const curr = result.candidates[i];
        expect(prev).toBeDefined();
        expect(curr).toBeDefined();
        if (prev && curr) {
          expect(prev.score).toBeGreaterThanOrEqual(curr.score);
        }
      }
    });

    it("selected is the first candidate (highest score)", async () => {
      const { selector } = makeSelector({ versionCount: 2, skipFullReview: true });
      const result = await selector.selectBest(defaultParams);

      const first = result.candidates[0];
      expect(first).toBeDefined();
      if (first) {
        expect(result.selected.versionIndex).toBe(first.versionIndex);
      }
    });

    it("each version has different temperature", async () => {
      const { selector } = makeSelector({
        versionCount: 3,
        temperaturePerturbation: 0.1,
        skipFullReview: true,
      });
      const result = await selector.selectBest(defaultParams);

      const temps = result.candidates.map((c) => c.temperature);
      const uniqueTemps = new Set(temps);
      expect(uniqueTemps.size).toBe(3);
    });

    it("version content is non-empty", async () => {
      const { selector } = makeSelector({ versionCount: 2, skipFullReview: true });
      const result = await selector.selectBest(defaultParams);

      for (const c of result.candidates) {
        expect(c.content).toBeTruthy();
        expect(c.wordCount).toBeGreaterThan(0);
      }
    });

    it("reports correct passingVersions count", async () => {
      const { selector } = makeSelector({ versionCount: 3, skipFullReview: true });
      const result = await selector.selectBest(defaultParams);

      const actualPassing = result.candidates.filter((c) => c.passed).length;
      expect(result.passingVersions).toBe(actualPassing);
      expect(result.hasPassingVersion).toBe(actualPassing > 0);
    });
  });

  describe("selectBest — parallel mode", () => {
    it("generates versions in parallel", async () => {
      const { selector } = makeSelector({
        versionCount: 3,
        parallel: true,
        skipFullReview: true,
      });

      const result = await selector.selectBest(defaultParams);

      expect(result.totalVersions).toBe(3);
      expect(result.candidates).toHaveLength(3);
    });
  });

  describe("selectBest — with ReviewEngine", () => {
    it("includes review results when ReviewEngine is provided", async () => {
      const { selector } = makeSelector({
        versionCount: 2,
        withReview: true,
        skipFullReview: false,
      });

      const result = await selector.selectBest(defaultParams);

      expect(result.totalVersions).toBe(2);
      // When review engine is active, reviewResult should be populated
      for (const c of result.candidates) {
        expect(c.reviewResult).toBeDefined();
        expect(c.reviewResult).not.toBeNull();
      }
    });
  });

  describe("selectBest — skipFullReview mode", () => {
    it("uses anti-AI score when skipFullReview is true", async () => {
      const { selector } = makeSelector({
        versionCount: 2,
        skipFullReview: true,
      });

      const result = await selector.selectBest(defaultParams);

      // In skip mode, reviewResult should be null
      for (const c of result.candidates) {
        expect(c.reviewResult).toBeNull();
      }
    });
  });

  describe("progress callbacks", () => {
    it("calls onProgress for each phase of each version", async () => {
      const progressUpdates: VersionProgress[] = [];
      const { selector } = makeSelector({
        versionCount: 2,
        skipFullReview: true,
        onProgress: (p) => progressUpdates.push(p),
      });

      await selector.selectBest(defaultParams);

      // Each version should have 3 progress updates: writing, reviewing, done
      expect(progressUpdates.length).toBe(6); // 2 versions × 3 phases

      // Check structure
      for (const p of progressUpdates) {
        expect(p.totalVersions).toBe(2);
        expect(["writing", "reviewing", "done"]).toContain(p.phase);
      }

      // Check version 1 phases
      const v1Updates = progressUpdates.filter((p) => p.versionIndex === 1);
      expect(v1Updates).toHaveLength(3);
      expect(v1Updates.map((p) => p.phase)).toEqual(["writing", "reviewing", "done"]);

      // "done" phase should include score and passed
      const doneUpdate = v1Updates.find((p) => p.phase === "done");
      expect(doneUpdate).toBeDefined();
      if (doneUpdate) {
        expect(typeof doneUpdate.score).toBe("number");
        expect(typeof doneUpdate.passed).toBe("boolean");
      }
    });

    it("calls onSelected when selection is complete", async () => {
      const selectedUpdates: VersionSelectedInfo[] = [];
      const { selector } = makeSelector({
        versionCount: 2,
        skipFullReview: true,
        onSelected: (i) => selectedUpdates.push(i),
      });

      await selector.selectBest(defaultParams);

      expect(selectedUpdates).toHaveLength(1);
      const info = selectedUpdates[0];
      expect(info).toBeDefined();
      if (info) {
        expect(info.totalVersions).toBe(2);
        expect(typeof info.selectedIndex).toBe("number");
        expect(typeof info.selectedScore).toBe("number");
        expect(typeof info.passingVersions).toBe("number");
      }
    });

    it("works without callbacks (null)", async () => {
      const { selector } = makeSelector({
        versionCount: 2,
        skipFullReview: true,
        // No callbacks
      });

      // Should not throw
      const result = await selector.selectBest(defaultParams);
      expect(result.totalVersions).toBe(2);
    });
  });

  describe("DEFAULT_VERSION_SELECTOR_CONFIG", () => {
    it("has expected defaults", () => {
      expect(DEFAULT_VERSION_SELECTOR_CONFIG.versionCount).toBe(3);
      expect(DEFAULT_VERSION_SELECTOR_CONFIG.temperaturePerturbation).toBe(0.08);
      expect(DEFAULT_VERSION_SELECTOR_CONFIG.parallel).toBe(false);
      expect(DEFAULT_VERSION_SELECTOR_CONFIG.skipFullReview).toBe(false);
    });
  });
});
