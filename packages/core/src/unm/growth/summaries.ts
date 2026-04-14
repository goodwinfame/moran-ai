import { SUMMARIES_HOT_WINDOW, SUMMARIES_WARM_WINDOW } from "../config.js";
import type { GrowthAction, GrowthContext, GrowthStrategy, MemorySlice } from "../types.js";

export class SummariesStrategy implements GrowthStrategy {
  apply(slices: MemorySlice[], context: GrowthContext): GrowthAction[] {
    const actions: GrowthAction[] = [];

    for (const slice of slices) {
      if (typeof slice.sourceChapter !== "number") {
        continue;
      }

      const distance = context.currentChapter - slice.sourceChapter;
      const targetTier =
        distance <= SUMMARIES_HOT_WINDOW ? "hot" : distance <= SUMMARIES_WARM_WINDOW ? "warm" : "cold";

      if (targetTier === slice.tier) {
        continue;
      }

      actions.push({
        sliceId: slice.id,
        action: targetTier === "hot" ? "upgrade" : "downgrade",
        newTier: targetTier,
        reason: `Summary window reassigned to ${targetTier}`,
      });
    }

    return actions;
  }
}
