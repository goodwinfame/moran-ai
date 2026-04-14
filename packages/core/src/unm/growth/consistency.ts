import { CONSISTENCY_STALE_CHAPTERS } from "../config.js";
import type { GrowthAction, GrowthContext, GrowthStrategy, MemorySlice } from "../types.js";
import { getNumericTag, hasTag } from "./index.js";

function getStatus(slice: MemorySlice): "planted" | "developing" | "resolved" | "stale" {
  if (hasTag(slice, "status:stale") || hasTag(slice, "stale")) {
    return "stale";
  }
  if (hasTag(slice, "status:resolved") || hasTag(slice, "resolved")) {
    return "resolved";
  }
  if (hasTag(slice, "status:developing") || hasTag(slice, "developing")) {
    return "developing";
  }
  return "planted";
}

export class ConsistencyStrategy implements GrowthStrategy {
  apply(slices: MemorySlice[], context: GrowthContext): GrowthAction[] {
    const actions: GrowthAction[] = [];

    for (const slice of slices) {
      const status = getStatus(slice);
      const lastChapter = getNumericTag(slice, "updatedChapter") ?? slice.sourceChapter ?? context.currentChapter;
      const chapterGap = context.currentChapter - lastChapter;

      if (chapterGap > CONSISTENCY_STALE_CHAPTERS) {
        actions.push({
          sliceId: slice.id,
          action: "reset",
          reason: "Consistency thread marked stale; attention required",
        });
        continue;
      }

      if (status === "planted") {
        actions.push({
          sliceId: slice.id,
          action: "upgrade",
          newTier: "hot",
          reason: "PLANTED advanced to DEVELOPING",
        });
        continue;
      }

      if (status === "resolved" && chapterGap >= 5 && slice.tier === "hot") {
        actions.push({
          sliceId: slice.id,
          action: "downgrade",
          newTier: "warm",
          reason: "Resolved consistency thread cooled after 5 chapters",
        });
        continue;
      }

      if (status === "stale") {
        actions.push({
          sliceId: slice.id,
          action: "reset",
          reason: "Consistency thread already stale; warning signal",
        });
      }
    }

    return actions;
  }
}
