import type { MemoryCategory, MemoryScope, MemoryStability, MemoryTier } from "../types/index.js";

/** MemorySlice — the core data unit */
export interface MemorySlice {
  id: string;
  projectId: string;
  category: MemoryCategory;
  scope: MemoryScope;
  stability: MemoryStability;
  tier: MemoryTier;
  priorityFloor: number;
  content: string;
  charCount: number;
  tokenCount: number;
  freshness: number;
  relevanceTags: string[];
  sourceChapter?: number;
  sourceAgent?: string;
  chapterNumber?: number;
  importance?: number;
  createdAt: Date;
  updatedAt: Date;
}

/** CapConfig — per-category token quota per tier */
export interface CapConfig {
  hot: number;
  warm: number;
  cold: number;
}

/** BudgetAllocation — per-category budget in the context window */
export interface BudgetAllocation {
  category: MemoryCategory;
  tokens: number;
}

/** WriteRequest — input to ManagedWrite pipeline */
export interface WriteRequest {
  projectId: string;
  category: MemoryCategory;
  content: string;
  scope?: MemoryScope;
  stability?: MemoryStability;
  tier?: MemoryTier;
  priorityFloor?: number;
  relevanceTags?: string[];
  sourceChapter?: number;
  sourceAgent?: string;
}

/** WriteResult — output of ManagedWrite pipeline */
export interface WriteResult {
  success: boolean;
  slice?: MemorySlice;
  evicted?: MemorySlice[];
  warnings?: string[];
}

/** ContextRequest — input to ContextAssembler */
export interface ContextRequest {
  projectId: string;
  chapterNumber: number;
  sceneCharacters?: string[];
  sceneTags?: string[];
  customBudget?: Partial<Record<MemoryCategory, number>>;
}

/** ContextResult — output of ContextAssembler */
export interface ContextResult {
  totalTokens: number;
  sections: ContextSection[];
  budgetUsage: Record<MemoryCategory, { allocated: number; used: number }>;
}

/** ContextSection — one category's rendered context */
export interface ContextSection {
  category: MemoryCategory;
  content: string;
  tokenCount: number;
  sliceCount: number;
}

/** SpiralReport — output when spiral is detected */
export interface SpiralReport {
  type: "review" | "inflation" | "contradiction";
  severity: "warning" | "critical";
  message: string;
  details: Record<string, unknown>;
  suggestedActions: string[];
  detectedAt: Date;
}

/** PressureReport — category pressure status */
export interface PressureReport {
  category: MemoryCategory;
  hot: { used: number; cap: number; percentage: number };
  warm: { used: number; cap: number; percentage: number };
  triggerCount: number;
  rootCause?: string;
  suggestedActions: string[];
}

/** SliceFilter — query filters for abstract store */
export interface SliceFilter {
  category?: MemoryCategory;
  tier?: MemoryTier;
  stability?: MemoryStability;
  minFreshness?: number;
  relevanceTags?: string[];
  sourceChapter?: number;
  scope?: MemoryScope;
}

/** Abstract storage interface — implemented by DB layer in M1.3 */
export interface SliceStore {
  /** Get slices by project + optional filters */
  query(projectId: string, filters?: SliceFilter): Promise<MemorySlice[]>;
  /** Insert a new slice */
  insert(slice: Omit<MemorySlice, "id" | "createdAt" | "updatedAt">): Promise<MemorySlice>;
  /** Update an existing slice */
  update(id: string, patch: Partial<MemorySlice>): Promise<MemorySlice>;
  /** Delete a slice */
  delete(id: string): Promise<void>;
  /** Count tokens per category per tier */
  countTokens(projectId: string, category: MemoryCategory, tier: MemoryTier): Promise<number>;
}

export interface GrowthContext {
  currentChapter: number;
  projectId: string;
  sceneCharacters?: string[];
}

export interface GrowthAction {
  sliceId: string;
  action: "downgrade" | "upgrade" | "evict" | "split" | "reject" | "reset";
  newTier?: MemoryTier;
  newFreshness?: number;
  reason: string;
}

/** Shared interface for all strategies */
export interface GrowthStrategy {
  /** Apply growth control to slices in a category, return slices to update/evict */
  apply(slices: MemorySlice[], context: GrowthContext): GrowthAction[];
}
