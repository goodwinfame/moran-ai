import type { MemorySlice } from "../types.js";

export * from "./guidance.js";
export * from "./world.js";
export * from "./characters.js";
export * from "./consistency.js";
export * from "./summaries.js";
export * from "./outline.js";

export function clampFreshness(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

export function hasTag(slice: MemorySlice, tag: string): boolean {
  const target = tag.toLowerCase();
  return slice.relevanceTags.some((item) => item.toLowerCase() === target);
}

export function getNumericTag(slice: MemorySlice, prefix: string): number | null {
  const lowerPrefix = `${prefix.toLowerCase()}:`;
  const matched = slice.relevanceTags.find((tag) => tag.toLowerCase().startsWith(lowerPrefix));
  if (!matched) {
    return null;
  }
  const [, value] = matched.split(":", 2);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
