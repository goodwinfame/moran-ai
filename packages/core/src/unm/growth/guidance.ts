import {
  GUIDANCE_COLD_THRESHOLD,
  GUIDANCE_DECAY_RATE,
  GUIDANCE_RESET_REFERENCES,
  GUIDANCE_WARM_THRESHOLD,
} from "../config.js";
import type { GrowthAction, GrowthContext, GrowthStrategy, MemorySlice } from "../types.js";
import { clampFreshness, getNumericTag } from "./index.js";

export class GuidanceStrategy implements GrowthStrategy {
  apply(slices: MemorySlice[], _context: GrowthContext): GrowthAction[] {
    const actions: GrowthAction[] = [];

    for (const slice of slices) {
      const references = getNumericTag(slice, "refs") ?? 0;
      if (references >= GUIDANCE_RESET_REFERENCES) {
        actions.push({
          sliceId: slice.id,
          action: "reset",
          newFreshness: 1,
          reason: `Referenced ${references} times; freshness reset`,
        });
        continue;
      }

      const nextFreshness = clampFreshness(slice.freshness * GUIDANCE_DECAY_RATE);
      if (nextFreshness < GUIDANCE_COLD_THRESHOLD && slice.tier !== "cold") {
        actions.push({
          sliceId: slice.id,
          action: "downgrade",
          newTier: "cold",
          newFreshness: nextFreshness,
          reason: "Guidance slice dropped below cold threshold",
        });
        continue;
      }

      if (nextFreshness < GUIDANCE_WARM_THRESHOLD && slice.tier === "hot") {
        actions.push({
          sliceId: slice.id,
          action: "downgrade",
          newTier: "warm",
          newFreshness: nextFreshness,
          reason: "Guidance slice dropped below warm threshold",
        });
        continue;
      }

      actions.push({
        sliceId: slice.id,
        action: "reset",
        newFreshness: nextFreshness,
        reason: "Guidance decay applied",
      });
    }

    return actions;
  }
}
