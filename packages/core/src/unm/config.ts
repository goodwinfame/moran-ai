import type { MemoryCategory } from "../types/index.js";
import type { CapConfig } from "./types.js";

/** DEFAULT_CAPS per §3.3 */
export const DEFAULT_CAPS: Record<MemoryCategory, CapConfig> = {
  guidance: { hot: 2000, warm: 5000, cold: Infinity },
  world: { hot: 4000, warm: 15000, cold: Infinity },
  characters: { hot: 6000, warm: 30000, cold: Infinity },
  consistency: { hot: 3000, warm: 20000, cold: Infinity },
  summaries: { hot: 4000, warm: 25000, cold: Infinity },
  outline: { hot: 5000, warm: 10000, cold: Infinity },
};

/** BUDGET per §3.4 */
export const TOTAL_BUDGET = 64000;
export const FIXED_OVERHEAD = 8000;
export const ALLOCATABLE = 56000;

export const DEFAULT_BUDGET: Record<MemoryCategory, number> = {
  outline: 8000,
  characters: 12000,
  world: 6000,
  summaries: 10000,
  consistency: 8000,
  guidance: 4000,
};

export const RESERVE_BUDGET = 8000;

/** GROWTH STRATEGY THRESHOLDS per §3.5 */
export const GUIDANCE_DECAY_RATE = 0.8;
export const GUIDANCE_WARM_THRESHOLD = 0.3;
export const GUIDANCE_COLD_THRESHOLD = 0.1;
export const GUIDANCE_RESET_REFERENCES = 3;

export const WORLD_MAX_SLICE_CHARS = 8000;

export const CHARACTER_APPEAR_BOOST = 1;
export const CHARACTER_ABSENT_DECAY = 0.9;

export const CONSISTENCY_STALE_CHAPTERS = 50;

export const SUMMARIES_HOT_WINDOW = 3;
export const SUMMARIES_WARM_WINDOW = 10;

export const OUTLINE_MAX_ARC_CHARS = 20000;

/** SPIRAL DETECTION per §3.6 */
export const SPIRAL_REVIEW_MAX_ROUNDS = 3;
export const SPIRAL_INFLATION_CONSECUTIVE = 3;
export const SPIRAL_CONTRADICTION_THRESHOLD = 2;

/** TOKEN ESTIMATION */
export const CHARS_PER_TOKEN = 1.5;
