import { describe, expect, it } from "vitest";

import { BudgetAllocator } from "../budget-allocator.js";
import { ALLOCATABLE, DEFAULT_BUDGET, FIXED_OVERHEAD, TOTAL_BUDGET } from "../config.js";

const baseRequest = {
  projectId: "proj-1",
  chapterNumber: 10,
};

describe("BudgetAllocator", () => {
  it("default allocation returns DEFAULT_BUDGET values", () => {
    const allocator = new BudgetAllocator();
    const allocations = allocator.allocate(baseRequest);

    const table = Object.fromEntries(allocations.map((a) => [a.category, a.tokens]));
    expect(table).toEqual(DEFAULT_BUDGET);
  });

  it("custom budget override replaces specific categories", () => {
    const allocator = new BudgetAllocator();
    const allocations = allocator.allocate({
      ...baseRequest,
      customBudget: {
        guidance: 1234,
      },
    });

    const table = Object.fromEntries(allocations.map((a) => [a.category, a.tokens]));
    expect(table.guidance).toBe(1234);
    expect(table.characters).toBe(DEFAULT_BUDGET.characters);
  });

  it("proportional scaling applies when request exceeds allocatable", () => {
    const hugeBudget = {
      outline: 20000,
      characters: 20000,
      world: 20000,
      summaries: 20000,
      consistency: 20000,
      guidance: 20000,
    };
    const allocator = new BudgetAllocator(hugeBudget);
    const allocations = allocator.allocate(baseRequest);
    const total = allocations.reduce((sum, a) => sum + a.tokens, 0);

    expect(total).toBeLessThanOrEqual(ALLOCATABLE);
    expect(allocations.every((a) => a.tokens <= 20000)).toBe(true);
  });

  it("allocations are sorted by descending token count", () => {
    const allocator = new BudgetAllocator({
      outline: 1,
      characters: 100,
      world: 40,
      summaries: 80,
      consistency: 20,
      guidance: 10,
    });
    const allocations = allocator.allocate(baseRequest);

    const tokens = allocations.map((a) => a.tokens);
    expect(tokens).toEqual([...tokens].sort((a, b) => b - a));
  });

  it("reserve calculation returns unallocated tokens", () => {
    const allocator = new BudgetAllocator(DEFAULT_BUDGET, TOTAL_BUDGET, FIXED_OVERHEAD);
    const reserve = allocator.getReserve();
    const expected = ALLOCATABLE - Object.values(DEFAULT_BUDGET).reduce((sum, n) => sum + n, 0);

    expect(reserve).toBe(expected);
  });

  it("supports custom total budget", () => {
    const totalBudget = 40000;
    const fixedOverhead = 5000;
    const allocator = new BudgetAllocator(DEFAULT_BUDGET, totalBudget, fixedOverhead);
    const allocations = allocator.allocate(baseRequest);
    const totalAllocated = allocations.reduce((sum, a) => sum + a.tokens, 0);

    expect(totalAllocated).toBeLessThanOrEqual(totalBudget - fixedOverhead);
  });

  it("zero budget category allocates zero", () => {
    const allocator = new BudgetAllocator({
      ...DEFAULT_BUDGET,
      guidance: 0,
    });
    const allocations = allocator.allocate(baseRequest);
    const guidance = allocations.find((a) => a.category === "guidance");

    expect(guidance?.tokens).toBe(0);
  });
});
