import { WORLD_MAX_SLICE_CHARS } from "../config.js";
import type { GrowthAction, GrowthContext, GrowthStrategy, MemorySlice } from "../types.js";

export class WorldStrategy implements GrowthStrategy {
  apply(slices: MemorySlice[], _context: GrowthContext): GrowthAction[] {
    const actions: GrowthAction[] = [];
    const nonCanon: MemorySlice[] = [];

    for (const slice of slices) {
      if (slice.charCount > WORLD_MAX_SLICE_CHARS) {
        actions.push({
          sliceId: slice.id,
          action: "split",
          reason: `Slice exceeds ${WORLD_MAX_SLICE_CHARS} chars`,
        });
      }

      if (slice.stability !== "canon") {
        nonCanon.push(slice);
      }
    }

    nonCanon
      .sort((a, b) => a.freshness - b.freshness)
      .forEach((slice) => {
        if (slice.tier === "hot") {
          actions.push({
            sliceId: slice.id,
            action: "downgrade",
            newTier: "warm",
            reason: "Non-canon world slice downgraded by freshness ordering",
          });
          return;
        }

        if (slice.tier === "warm") {
          actions.push({
            sliceId: slice.id,
            action: "downgrade",
            newTier: "cold",
            reason: "Non-canon world slice downgraded by freshness ordering",
          });
        }
      });

    return actions;
  }
}
