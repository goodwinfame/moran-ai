import type { MemoryCategory, MemoryStability, MemoryTier } from "../types/index.js";
import { CHARS_PER_TOKEN, DEFAULT_CAPS } from "./config.js";
import { writeRequestSchema } from "./schemas.js";
import type { CapConfig, MemorySlice, SliceStore, WriteRequest, WriteResult } from "./types.js";

const DEFAULT_STABILITY: Record<MemoryCategory, MemoryStability> = {
  world: "canon",
  guidance: "ephemeral",
  characters: "evolving",
  consistency: "evolving",
  summaries: "evolving",
  outline: "evolving",
};

export class ManagedWrite {
  constructor(
    private readonly store: SliceStore,
    private readonly caps: Record<MemoryCategory, CapConfig> = DEFAULT_CAPS,
  ) {}

  async write(request: WriteRequest): Promise<WriteResult> {
    const parsed = writeRequestSchema.safeParse(request);
    if (!parsed.success) {
      return {
        success: false,
        warnings: parsed.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`),
      };
    }

    const input = parsed.data;
    const tier: MemoryTier = input.tier ?? "warm";
    const classified = {
      ...input,
      scope: input.scope ?? "chapter",
      stability: input.stability ?? DEFAULT_STABILITY[input.category],
      tier,
      priorityFloor: input.priorityFloor ?? 50,
      relevanceTags: input.relevanceTags ?? [],
    };

    const charCount = classified.content.length;
    const tokenCount = Math.max(1, Math.ceil(charCount / CHARS_PER_TOKEN));

    const inserted = await this.store.insert({
      ...classified,
      charCount,
      tokenCount,
      freshness: 1,
    });

    const evicted = await this.applyBackpressure(inserted.projectId, inserted.category, inserted.tier);
    const warnings = evicted.length > 0 ? [`Backpressure triggered for ${inserted.category}/${inserted.tier}`] : [];

    return {
      success: true,
      slice: inserted,
      evicted,
      warnings,
    };
  }

  private async applyBackpressure(
    projectId: string,
    category: MemoryCategory,
    tier: MemoryTier,
  ): Promise<MemorySlice[]> {
    const cap = this.caps[category][tier];
    if (!Number.isFinite(cap)) {
      return [];
    }

    const affected: MemorySlice[] = [];
    let used = await this.store.countTokens(projectId, category, tier);

    while (used > cap) {
      const candidates = await this.store.query(projectId, { category, tier });
      if (candidates.length === 0) {
        break;
      }

      const stalest = candidates.sort((a, b) => a.freshness - b.freshness)[0];
      if (!stalest) {
        break;
      }
      if (tier === "hot") {
        const updated = await this.store.update(stalest.id, { tier: "warm" });
        affected.push(updated);
      } else if (tier === "warm") {
        const updated = await this.store.update(stalest.id, { tier: "cold" });
        affected.push(updated);
      } else {
        await this.store.delete(stalest.id);
        affected.push(stalest);
      }

      used = await this.store.countTokens(projectId, category, tier);
    }

    return affected;
  }
}
