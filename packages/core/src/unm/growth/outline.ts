import { OUTLINE_MAX_ARC_CHARS } from "../config.js";
import type { GrowthAction, GrowthContext, GrowthStrategy, MemorySlice } from "../types.js";
import { hasTag } from "./index.js";

export class OutlineStrategy implements GrowthStrategy {
  apply(slices: MemorySlice[], _context: GrowthContext): GrowthAction[] {
    const actions: GrowthAction[] = [];
    const arcSlices = slices.filter((slice) => slice.scope === "arc");
    const totalArcChars = arcSlices.reduce((sum, slice) => sum + slice.charCount, 0);

    if (totalArcChars > OUTLINE_MAX_ARC_CHARS && arcSlices.length > 0) {
      const largest = [...arcSlices].sort((a, b) => b.charCount - a.charCount)[0];
      if (!largest) {
        return actions;
      }
      actions.push({
        sliceId: largest.id,
        action: "reject",
        reason: `Arc outline exceeds ${OUTLINE_MAX_ARC_CHARS} chars`,
      });
    }

    for (const slice of arcSlices) {
      if ((hasTag(slice, "status:completed") || hasTag(slice, "completed")) && slice.tier !== "cold") {
        actions.push({
          sliceId: slice.id,
          action: "downgrade",
          newTier: "cold",
          reason: "Completed arc plan downgraded to cold tier",
        });
      }
    }

    return actions;
  }
}
