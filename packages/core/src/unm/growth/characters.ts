import { CHARACTER_ABSENT_DECAY, CHARACTER_APPEAR_BOOST } from "../config.js";
import type { GrowthAction, GrowthContext, GrowthStrategy, MemorySlice } from "../types.js";
import { clampFreshness } from "./index.js";

export class CharacterStrategy implements GrowthStrategy {
  apply(slices: MemorySlice[], context: GrowthContext): GrowthAction[] {
    const activeCharacters = new Set((context.sceneCharacters ?? []).map((name) => name.toLowerCase()));
    const actions: GrowthAction[] = [];

    for (const slice of slices) {
      const appears = slice.relevanceTags.some((tag) => activeCharacters.has(tag.toLowerCase()));
      const nextFreshness = appears
        ? clampFreshness(slice.freshness + CHARACTER_APPEAR_BOOST)
        : clampFreshness(slice.freshness * CHARACTER_ABSENT_DECAY);

      let newTier: MemorySlice["tier"];
      if (nextFreshness >= 0.75) {
        newTier = "hot";
      } else if (nextFreshness >= 0.35) {
        newTier = "warm";
      } else {
        newTier = "cold";
      }

      if (newTier !== slice.tier) {
        actions.push({
          sliceId: slice.id,
          action: newTier === "hot" && slice.tier !== "hot" ? "upgrade" : "downgrade",
          newTier,
          newFreshness: nextFreshness,
          reason: appears ? "Character appears in scene" : "Character absent from scene",
        });
      } else {
        actions.push({
          sliceId: slice.id,
          action: "reset",
          newFreshness: nextFreshness,
          reason: appears ? "Activity boost applied" : "Absence decay applied",
        });
      }
    }

    return actions;
  }
}
