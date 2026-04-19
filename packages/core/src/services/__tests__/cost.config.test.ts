import { describe, it, expect } from "vitest";
import { calculateCost, MODEL_PRICING } from "../cost.config.js";

describe("MODEL_PRICING", () => {
  it("contains all required models", () => {
    const required = ["claude-sonnet-4", "claude-opus-4", "gpt-4o", "kimi-k2", "gemma-4"];
    for (const model of required) {
      expect(MODEL_PRICING[model]).toBeDefined();
      expect(typeof MODEL_PRICING[model].input).toBe("number");
      expect(typeof MODEL_PRICING[model].output).toBe("number");
    }
  });

  it("gemma-4 has zero cost (local model)", () => {
    expect(MODEL_PRICING["gemma-4"].input).toBe(0);
    expect(MODEL_PRICING["gemma-4"].output).toBe(0);
  });
});

describe("calculateCost", () => {
  describe("known models", () => {
    it("calculates cost for claude-sonnet-4", () => {
      // 1M prompt tokens at $3/M + 1M completion at $15/M = $18
      const cost = calculateCost("claude-sonnet-4", 1_000_000, 1_000_000);
      expect(cost).toBe(18);
    });

    it("calculates cost for claude-opus-4", () => {
      // 1M prompt at $15/M + 1M completion at $75/M = $90
      const cost = calculateCost("claude-opus-4", 1_000_000, 1_000_000);
      expect(cost).toBe(90);
    });

    it("calculates cost for gpt-4o", () => {
      // 2M prompt at $2.5/M + 1M completion at $10/M = $5 + $10 = $15
      const cost = calculateCost("gpt-4o", 2_000_000, 1_000_000);
      expect(cost).toBe(15);
    });

    it("calculates cost for kimi-k2", () => {
      // 500K prompt at $1/M + 500K completion at $3/M = $0.5 + $1.5 = $2
      const cost = calculateCost("kimi-k2", 500_000, 500_000);
      expect(cost).toBeCloseTo(2, 8);
    });

    it("returns 0 for gemma-4 (local model)", () => {
      const cost = calculateCost("gemma-4", 100_000, 50_000);
      expect(cost).toBe(0);
    });

    it("scales proportionally with token count", () => {
      const half = calculateCost("claude-sonnet-4", 500_000, 500_000);
      const full = calculateCost("claude-sonnet-4", 1_000_000, 1_000_000);
      expect(full).toBeCloseTo(half * 2, 8);
    });
  });

  describe("unknown models", () => {
    it("returns 0 for unknown model", () => {
      expect(calculateCost("unknown-model", 1_000_000, 1_000_000)).toBe(0);
    });

    it("returns 0 for empty string model", () => {
      expect(calculateCost("", 1_000_000, 1_000_000)).toBe(0);
    });
  });

  describe("zero tokens", () => {
    it("returns 0 when both token counts are 0", () => {
      expect(calculateCost("claude-sonnet-4", 0, 0)).toBe(0);
    });

    it("returns 0 for prompt-only tokens on gemma-4", () => {
      expect(calculateCost("gemma-4", 1_000_000, 0)).toBe(0);
    });

    it("calculates cost with only prompt tokens", () => {
      // 1M prompt at $3/M, 0 completion = $3
      expect(calculateCost("claude-sonnet-4", 1_000_000, 0)).toBe(3);
    });

    it("calculates cost with only completion tokens", () => {
      // 0 prompt, 1M completion at $15/M = $15
      expect(calculateCost("claude-sonnet-4", 0, 1_000_000)).toBe(15);
    });
  });
});
