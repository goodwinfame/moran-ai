import type { MemorySlice, SliceStore } from "../types.js";

export function createMockStore(initialSlices: MemorySlice[] = []): SliceStore {
  let slices = [...initialSlices];
  let nextId = 1;

  return {
    async query(projectId, filters) {
      return slices.filter((s) => {
        if (s.projectId !== projectId) return false;
        if (filters?.category && s.category !== filters.category) return false;
        if (filters?.tier && s.tier !== filters.tier) return false;
        if (filters?.stability && s.stability !== filters.stability) return false;
        if (filters?.scope && s.scope !== filters.scope) return false;
        if (filters?.minFreshness && s.freshness < filters.minFreshness) return false;
        return true;
      });
    },
    async insert(data) {
      const slice: MemorySlice = {
        ...data,
        id: `test-${nextId++}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as MemorySlice;
      slices.push(slice);
      return slice;
    },
    async update(id, patch) {
      const idx = slices.findIndex((s) => s.id === id);
      if (idx === -1) throw new Error(`Slice ${id} not found`);
      slices[idx] = { ...slices[idx], ...patch, updatedAt: new Date() } as MemorySlice;
      return slices[idx];
    },
    async delete(id) {
      slices = slices.filter((s) => s.id !== id);
    },
    async countTokens(projectId, category, tier) {
      return slices
        .filter((s) => s.projectId === projectId && s.category === category && s.tier === tier)
        .reduce((sum, s) => sum + s.tokenCount, 0);
    },
  };
}

export function makeSlice(overrides: Partial<MemorySlice> = {}): MemorySlice {
  return {
    id: `slice-${Math.random().toString(36).slice(2, 8)}`,
    projectId: "proj-1",
    category: "guidance",
    scope: "chapter",
    stability: "evolving",
    tier: "warm",
    priorityFloor: 50,
    content: "Test content",
    charCount: 12,
    tokenCount: 8,
    freshness: 1.0,
    relevanceTags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export const VALID_PROJECT_ID = "11111111-1111-4111-8111-111111111111";
