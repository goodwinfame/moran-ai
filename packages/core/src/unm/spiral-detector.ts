import type { MemoryCategory } from "../types/index.js";
import {
  DEFAULT_CAPS,
  SPIRAL_CONTRADICTION_THRESHOLD,
  SPIRAL_INFLATION_CONSECUTIVE,
  SPIRAL_REVIEW_MAX_ROUNDS,
} from "./config.js";
import type { CapConfig, PressureReport, SliceStore, SpiralReport } from "./types.js";

export class SpiralDetector {
  constructor(private readonly caps: Record<MemoryCategory, CapConfig> = DEFAULT_CAPS) {}

  /** Detect review spiral — same chapter reviewed too many times */
  detectReviewSpiral(chapterId: string, reviewCount: number): SpiralReport | null {
    if (reviewCount <= SPIRAL_REVIEW_MAX_ROUNDS) {
      return null;
    }

    return {
      type: "review",
      severity: "critical",
      message: `Chapter ${chapterId} exceeded review round limit`,
      details: { chapterId, reviewCount, limit: SPIRAL_REVIEW_MAX_ROUNDS },
      suggestedActions: ["Freeze chapter edits", "Escalate to director review", "Apply rewrite lane"],
      detectedAt: new Date(),
    };
  }

  /** Detect inflation spiral — category cap triggered too many consecutive times */
  detectInflationSpiral(category: MemoryCategory, consecutiveTriggers: number): SpiralReport | null {
    if (consecutiveTriggers < SPIRAL_INFLATION_CONSECUTIVE) {
      return null;
    }

    return {
      type: "inflation",
      severity: "warning",
      message: `Category ${category} hit cap in consecutive writes`,
      details: { category, consecutiveTriggers, threshold: SPIRAL_INFLATION_CONSECUTIVE },
      suggestedActions: ["Run category compaction", "Increase cold storage summarization", "Raise warm downgrade aggressiveness"],
      detectedAt: new Date(),
    };
  }

  /** Detect contradiction spiral — too many contradictions for one entity */
  detectContradictionSpiral(entityId: string, contradictionCount: number): SpiralReport | null {
    if (contradictionCount <= SPIRAL_CONTRADICTION_THRESHOLD) {
      return null;
    }

    return {
      type: "contradiction",
      severity: "critical",
      message: `Entity ${entityId} exceeded contradiction threshold`,
      details: { entityId, contradictionCount, threshold: SPIRAL_CONTRADICTION_THRESHOLD },
      suggestedActions: ["Lock entity canon", "Require contradiction resolution note", "Add reviewer gate"],
      detectedAt: new Date(),
    };
  }

  /** Generate pressure report for a category */
  async generatePressureReport(
    category: MemoryCategory,
    store: SliceStore,
    projectId: string,
  ): Promise<PressureReport> {
    const [hotUsed, warmUsed] = await Promise.all([
      store.countTokens(projectId, category, "hot"),
      store.countTokens(projectId, category, "warm"),
    ]);

    const hotCap = this.caps[category].hot;
    const warmCap = this.caps[category].warm;
    const hotPercentage = Number.isFinite(hotCap) && hotCap > 0 ? (hotUsed / hotCap) * 100 : 0;
    const warmPercentage = Number.isFinite(warmCap) && warmCap > 0 ? (warmUsed / warmCap) * 100 : 0;

    const suggestedActions: string[] = [];
    let rootCause: string | undefined;
    if (hotPercentage >= 90) {
      rootCause = "hot tier saturation";
      suggestedActions.push("Downgrade low-freshness hot slices", "Increase hot-to-warm pressure frequency");
    }
    if (warmPercentage >= 90) {
      rootCause = rootCause ? `${rootCause} + warm tier saturation` : "warm tier saturation";
      suggestedActions.push("Summarize warm slices to cold", "Increase archival compaction");
    }
    if (suggestedActions.length === 0) {
      suggestedActions.push("No immediate action required");
    }

    return {
      category,
      hot: { used: hotUsed, cap: hotCap, percentage: hotPercentage },
      warm: { used: warmUsed, cap: warmCap, percentage: warmPercentage },
      triggerCount: hotPercentage >= 100 || warmPercentage >= 100 ? 1 : 0,
      rootCause,
      suggestedActions,
    };
  }
}
