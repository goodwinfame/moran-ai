import type { MemoryCategory } from "../types/index.js";
import { ALLOCATABLE, DEFAULT_BUDGET, FIXED_OVERHEAD, TOTAL_BUDGET } from "./config.js";
import type { BudgetAllocation, ContextRequest } from "./types.js";

const CATEGORY_ORDER = Object.keys(DEFAULT_BUDGET) as MemoryCategory[];

export class BudgetAllocator {
  private readonly baseBudget: Record<MemoryCategory, number>;
  private readonly allocatable: number;

  constructor(
    budget: Record<MemoryCategory, number> = DEFAULT_BUDGET,
    totalBudget = TOTAL_BUDGET,
    fixedOverhead = FIXED_OVERHEAD,
  ) {
    this.baseBudget = { ...budget };
    this.allocatable = Math.max(0, Math.min(totalBudget - fixedOverhead, ALLOCATABLE));
  }

  /** Compute budget allocation for a chapter write */
  allocate(request: ContextRequest): BudgetAllocation[] {
    const merged: Record<MemoryCategory, number> = { ...this.baseBudget };
    if (request.customBudget) {
      for (const [category, tokens] of Object.entries(request.customBudget) as [MemoryCategory, number][]) {
        merged[category] = Math.max(0, Math.floor(tokens));
      }
    }

    const totalRequested = CATEGORY_ORDER.reduce((sum, category) => sum + merged[category], 0);
    const scale = totalRequested > this.allocatable && totalRequested > 0 ? this.allocatable / totalRequested : 1;

    return CATEGORY_ORDER.map((category) => ({
      category,
      tokens: Math.floor(merged[category] * scale),
    })).sort((a, b) => b.tokens - a.tokens);
  }

  /** Get the reserve (unallocated) tokens */
  getReserve(): number {
    const allocated = CATEGORY_ORDER.reduce((sum, category) => sum + this.baseBudget[category], 0);
    return Math.max(0, this.allocatable - allocated);
  }
}
