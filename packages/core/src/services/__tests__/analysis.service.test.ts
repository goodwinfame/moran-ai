import { describe, expect, it, vi, beforeEach } from "vitest";

// ── DB mock setup ─────────────────────────────────────────────────────────────

const mockSelectLimit = vi.fn();
const mockSelectOrderBy = vi.fn();
const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit, orderBy: mockSelectOrderBy }));
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere, orderBy: mockSelectOrderBy }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));
const mockInsertReturning = vi.fn();
const mockInsert = vi.fn(() => ({ values: vi.fn(() => ({ returning: mockInsertReturning })) }));

vi.mock("../../db/index.js", () => ({
  getDb: () => ({ select: mockSelect, insert: mockInsert }),
}));

import { save, read, list, trend } from "../analysis.service.js";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── save ──────────────────────────────────────────────────────────────────────

describe("save", () => {
  const analysisData = {
    scope: "chapter" as const,
    range: { start: 1, end: 3 },
    dimensions: {
      plot: { score: 80, analysis: "Good", suggestions: [] },
    },
    overall: 80,
    topIssues: ["pacing"],
  };

  it("creates doc with correct category, title, and metadata", async () => {
    mockInsertReturning.mockResolvedValue([{ id: "ana-1" }]);
    const res = await save("proj-1", analysisData);
    expect(res).toEqual({ ok: true, data: { id: "ana-1" } });
    expect(mockInsert).toHaveBeenCalled();
  });

  it("handles insert failure (empty returning)", async () => {
    mockInsertReturning.mockResolvedValue([]);
    const res = await save("proj-1", analysisData);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("INSERT_FAILED");
  });

  it("generates title 'full' when no range provided", async () => {
    mockInsertReturning.mockResolvedValue([{ id: "ana-2" }]);
    const fullData = { ...analysisData, range: undefined, scope: "full" as const };
    const res = await save("proj-1", fullData);
    expect(res).toEqual({ ok: true, data: { id: "ana-2" } });
  });
});

// ── read ──────────────────────────────────────────────────────────────────────

describe("read", () => {
  it("returns doc by ID", async () => {
    const doc = { id: "ana-1", category: "analysis", content: "{}" };
    mockSelectLimit.mockResolvedValue([doc]);
    const res = await read("proj-1", "ana-1");
    expect(res).toEqual({ ok: true, data: doc });
  });

  it("returns NOT_FOUND for missing analysis ID", async () => {
    mockSelectLimit.mockResolvedValue([]);
    const res = await read("proj-1", "nonexistent");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("NOT_FOUND");
  });
});

// ── list ──────────────────────────────────────────────────────────────────────

describe("list", () => {
  it("returns all analysis docs ordered by createdAt desc", async () => {
    const docs = [
      { id: "a2", createdAt: new Date("2024-02-01") },
      { id: "a1", createdAt: new Date("2024-01-01") },
    ];
    mockSelectOrderBy.mockResolvedValue(docs);
    const res = await list("proj-1");
    expect(res).toEqual({ ok: true, data: docs });
  });

  it("filters by scope when provided", async () => {
    const docs = [{ id: "a1", metadata: { scope: "chapter" } }];
    mockSelectOrderBy.mockResolvedValue(docs);
    const res = await list("proj-1", { scope: "chapter" });
    expect(res).toEqual({ ok: true, data: docs });
  });

  it("returns only most recent doc when latest=true", async () => {
    const docs = [
      { id: "a2", createdAt: new Date("2024-02-01") },
      { id: "a1", createdAt: new Date("2024-01-01") },
    ];
    mockSelectOrderBy.mockResolvedValue(docs);
    const res = await list("proj-1", { latest: true });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toHaveLength(1);
      expect(res.data[0]?.id).toBe("a2");
    }
  });
});

// ── trend ─────────────────────────────────────────────────────────────────────

describe("trend", () => {
  it("returns id/scope/overall/createdAt array ordered by createdAt asc", async () => {
    const d1 = new Date("2024-01-01");
    const d2 = new Date("2024-01-15");
    const rows = [
      { id: "a1", metadata: { scope: "chapter", overall: 70 }, createdAt: d1 },
      { id: "a2", metadata: { scope: "arc", overall: 82 }, createdAt: d2 },
    ];
    mockSelectOrderBy.mockResolvedValue(rows);
    const res = await trend("proj-1");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toHaveLength(2);
      expect(res.data[0]).toEqual({ id: "a1", scope: "chapter", overall: 70, createdAt: d1 });
      expect(res.data[1]).toEqual({ id: "a2", scope: "arc", overall: 82, createdAt: d2 });
    }
  });

  it("returns empty array when no analysis docs exist", async () => {
    mockSelectOrderBy.mockResolvedValue([]);
    const res = await trend("proj-1");
    expect(res).toEqual({ ok: true, data: [] });
  });
});
