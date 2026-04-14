import { describe, expect, it } from "vitest";

import { CharacterStrategy } from "../growth/characters.js";
import { ConsistencyStrategy } from "../growth/consistency.js";
import { GuidanceStrategy } from "../growth/guidance.js";
import { OutlineStrategy } from "../growth/outline.js";
import { SummariesStrategy } from "../growth/summaries.js";
import { WorldStrategy } from "../growth/world.js";
import type { GrowthContext } from "../types.js";
import { makeSlice } from "./helpers.js";

const context: GrowthContext = {
  currentChapter: 100,
  projectId: "proj-1",
  sceneCharacters: ["Alice"],
};

describe("Growth strategies", () => {
  describe("GuidanceStrategy", () => {
    it("applies decay: freshness multiplied by 0.8", () => {
      const strategy = new GuidanceStrategy();
      const actions = strategy.apply([makeSlice({ id: "g1", freshness: 0.5, tier: "warm" })], context);

      expect(actions[0]?.action).toBe("reset");
      expect(actions[0]?.newFreshness).toBeCloseTo(0.4);
    });

    it("downgrades hot->warm when below warm threshold", () => {
      const strategy = new GuidanceStrategy();
      const actions = strategy.apply([makeSlice({ id: "g2", freshness: 0.2, tier: "hot" })], context);

      expect(actions[0]?.action).toBe("downgrade");
      expect(actions[0]?.newTier).toBe("warm");
    });

    it("downgrades to cold when below cold threshold", () => {
      const strategy = new GuidanceStrategy();
      const actions = strategy.apply([makeSlice({ id: "g3", freshness: 0.1, tier: "warm" })], context);

      expect(actions[0]?.action).toBe("downgrade");
      expect(actions[0]?.newTier).toBe("cold");
    });

    it("resets freshness to 1.0 when refs >= 3", () => {
      const strategy = new GuidanceStrategy();
      const actions = strategy.apply(
        [makeSlice({ id: "g4", freshness: 0.1, tier: "cold", relevanceTags: ["refs:3"] })],
        context,
      );

      expect(actions[0]?.action).toBe("reset");
      expect(actions[0]?.newFreshness).toBe(1);
    });
  });

  describe("WorldStrategy", () => {
    it("protects canon slices from downgrade", () => {
      const strategy = new WorldStrategy();
      const actions = strategy.apply(
        [makeSlice({ id: "w1", category: "world", stability: "canon", tier: "hot", freshness: 0.1 })],
        context,
      );

      expect(actions).toEqual([]);
    });

    it("forces split when charCount > 8000", () => {
      const strategy = new WorldStrategy();
      const actions = strategy.apply(
        [makeSlice({ id: "w2", category: "world", stability: "canon", charCount: 9000 })],
        context,
      );

      expect(actions[0]?.action).toBe("split");
    });

    it("downgrades non-canon slices by freshness ordering", () => {
      const strategy = new WorldStrategy();
      const actions = strategy.apply(
        [
          makeSlice({ id: "w3", category: "world", stability: "evolving", tier: "hot", freshness: 0.2 }),
          makeSlice({ id: "w4", category: "world", stability: "evolving", tier: "warm", freshness: 0.1 }),
        ],
        context,
      );

      expect(actions[0]?.sliceId).toBe("w4");
      expect(actions[0]?.newTier).toBe("cold");
      expect(actions[1]?.sliceId).toBe("w3");
      expect(actions[1]?.newTier).toBe("warm");
    });
  });

  describe("CharacterStrategy", () => {
    it("boosts freshness when character appears in scene", () => {
      const strategy = new CharacterStrategy();
      const actions = strategy.apply(
        [makeSlice({ id: "c1", category: "characters", tier: "cold", freshness: 0.2, relevanceTags: ["alice"] })],
        context,
      );

      expect(actions[0]?.newFreshness).toBe(1);
    });

    it("decays freshness when character absent", () => {
      const strategy = new CharacterStrategy();
      const actions = strategy.apply(
        [makeSlice({ id: "c2", category: "characters", tier: "warm", freshness: 0.5, relevanceTags: ["bob"] })],
        context,
      );

      expect(actions[0]?.action).toBe("reset");
      expect(actions[0]?.newFreshness).toBeCloseTo(0.45);
    });

    it("upgrades to hot at high freshness", () => {
      const strategy = new CharacterStrategy();
      const actions = strategy.apply(
        [makeSlice({ id: "c3", category: "characters", tier: "warm", freshness: 0.9, relevanceTags: ["bob"] })],
        context,
      );

      expect(actions[0]?.action).toBe("upgrade");
      expect(actions[0]?.newTier).toBe("hot");
    });

    it("downgrades to cold at low freshness", () => {
      const strategy = new CharacterStrategy();
      const actions = strategy.apply(
        [makeSlice({ id: "c4", category: "characters", tier: "warm", freshness: 0.2, relevanceTags: ["bob"] })],
        context,
      );

      expect(actions[0]?.action).toBe("downgrade");
      expect(actions[0]?.newTier).toBe("cold");
    });
  });

  describe("ConsistencyStrategy", () => {
    it("marks stale when chapter gap > 50", () => {
      const strategy = new ConsistencyStrategy();
      const actions = strategy.apply(
        [
          makeSlice({
            id: "k1",
            category: "consistency",
            sourceChapter: 40,
            relevanceTags: ["status:developing", "updatedChapter:40"],
          }),
        ],
        context,
      );

      expect(actions[0]?.action).toBe("reset");
      expect(actions[0]?.reason).toContain("stale");
    });

    it("downgrades resolved hot slices after 5 chapters", () => {
      const strategy = new ConsistencyStrategy();
      const actions = strategy.apply(
        [
          makeSlice({
            id: "k2",
            category: "consistency",
            tier: "hot",
            sourceChapter: 95,
            relevanceTags: ["status:resolved"],
          }),
        ],
        context,
      );

      expect(actions[0]?.action).toBe("downgrade");
      expect(actions[0]?.newTier).toBe("warm");
    });

    it("upgrades planted slices to hot", () => {
      const strategy = new ConsistencyStrategy();
      const actions = strategy.apply(
        [
          makeSlice({
            id: "k3",
            category: "consistency",
            tier: "warm",
            sourceChapter: 99,
            relevanceTags: ["status:planted"],
          }),
        ],
        context,
      );

      expect(actions[0]?.action).toBe("upgrade");
      expect(actions[0]?.newTier).toBe("hot");
    });
  });

  describe("SummariesStrategy", () => {
    it("assigns recent 3 chapters to hot tier", () => {
      const strategy = new SummariesStrategy();
      const actions = strategy.apply(
        [makeSlice({ id: "s1", category: "summaries", tier: "warm", sourceChapter: 99 })],
        context,
      );

      expect(actions[0]?.newTier).toBe("hot");
    });

    it("assigns recent 10 chapters to warm tier", () => {
      const strategy = new SummariesStrategy();
      const actions = strategy.apply(
        [makeSlice({ id: "s2", category: "summaries", tier: "cold", sourceChapter: 92 })],
        context,
      );

      expect(actions[0]?.newTier).toBe("warm");
    });

    it("assigns older summaries to cold tier", () => {
      const strategy = new SummariesStrategy();
      const actions = strategy.apply(
        [makeSlice({ id: "s3", category: "summaries", tier: "warm", sourceChapter: 70 })],
        context,
      );

      expect(actions[0]?.newTier).toBe("cold");
    });
  });

  describe("OutlineStrategy", () => {
    it("rejects largest arc slice when max arc chars exceeded", () => {
      const strategy = new OutlineStrategy();
      const actions = strategy.apply(
        [
          makeSlice({ id: "o1", category: "outline", scope: "arc", charCount: 15000 }),
          makeSlice({ id: "o2", category: "outline", scope: "arc", charCount: 7000 }),
        ],
        context,
      );

      expect(actions[0]?.action).toBe("reject");
      expect(actions[0]?.sliceId).toBe("o1");
    });

    it("downgrades completed arc slices to cold", () => {
      const strategy = new OutlineStrategy();
      const actions = strategy.apply(
        [
          makeSlice({
            id: "o3",
            category: "outline",
            scope: "arc",
            tier: "hot",
            relevanceTags: ["status:completed"],
          }),
        ],
        context,
      );

      expect(actions[0]?.action).toBe("downgrade");
      expect(actions[0]?.newTier).toBe("cold");
    });
  });
});
