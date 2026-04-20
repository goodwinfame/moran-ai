import { describe, expect, it, vi, beforeEach } from "vitest";

// ── DB mock setup ─────────────────────────────────────────────────────────────

const mockSelectLimit = vi.fn();
const mockSelectOrderBy = vi.fn();
const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit, orderBy: mockSelectOrderBy }));
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere, orderBy: mockSelectOrderBy }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));
const mockInsertReturning = vi.fn();
const mockInsert = vi.fn(() => ({ values: vi.fn(() => ({ returning: mockInsertReturning })) }));
const mockUpdateReturning = vi.fn();
const mockUpdate = vi.fn(() => ({
  set: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockUpdateReturning })) })),
}));

vi.mock("../../db/index.js", () => ({
  getDb: () => ({ select: mockSelect, insert: mockInsert, update: mockUpdate }),
}));

import {
  saveRound,
  readRound,
  readByChapter,
  list,
  isChapterPassed,
} from "../review.service.js";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── saveRound ─────────────────────────────────────────────────────────────────

describe("saveRound", () => {
  const result = { passed: true, issues: [] };

  it("creates doc when no existing round found (insert path)", async () => {
    mockSelectLimit.mockResolvedValue([]);
    mockInsertReturning.mockResolvedValue([{ id: "doc-1" }]);
    const res = await saveRound("proj-1", 1, 1, result);
    expect(res).toEqual({ ok: true, data: { id: "doc-1" } });
    expect(mockInsert).toHaveBeenCalled();
  });

  it("handles insert failure (empty returning)", async () => {
    mockSelectLimit.mockResolvedValue([]);
    mockInsertReturning.mockResolvedValue([]);
    const res = await saveRound("proj-1", 1, 1, result);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("INSERT_FAILED");
  });

  it("updates existing round and increments version", async () => {
    mockSelectLimit.mockResolvedValue([{ id: "doc-1" }]);
    mockUpdateReturning.mockResolvedValue([{ id: "doc-1" }]);
    const res = await saveRound("proj-1", 1, 1, result);
    expect(res).toEqual({ ok: true, data: { id: "doc-1" } });
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns UPDATE_FAILED when update returns empty rows", async () => {
    mockSelectLimit.mockResolvedValue([{ id: "doc-1" }]);
    mockUpdateReturning.mockResolvedValue([]);
    const res = await saveRound("proj-1", 1, 1, result);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("UPDATE_FAILED");
  });
});

// ── readRound ─────────────────────────────────────────────────────────────────

describe("readRound", () => {
  it("returns doc when found by chapterNumber + round", async () => {
    const doc = { id: "doc-1", category: "review", metadata: { chapterNumber: 2, round: 3 } };
    mockSelectLimit.mockResolvedValue([doc]);
    const res = await readRound("proj-1", 2, 3);
    expect(res).toEqual({ ok: true, data: doc });
  });

  it("returns NOT_FOUND when no matching round", async () => {
    mockSelectLimit.mockResolvedValue([]);
    const res = await readRound("proj-1", 99, 1);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("NOT_FOUND");
  });
});

// ── readByChapter ─────────────────────────────────────────────────────────────

describe("readByChapter", () => {
  it("returns all rounds for chapter sorted by round", async () => {
    const docs = [
      { id: "d1", metadata: { chapterNumber: 1, round: 1 } },
      { id: "d2", metadata: { chapterNumber: 1, round: 2 } },
    ];
    mockSelectOrderBy.mockResolvedValue(docs);
    const res = await readByChapter("proj-1", 1);
    expect(res).toEqual({ ok: true, data: docs });
  });

  it("returns empty array when no reviews for chapter", async () => {
    mockSelectOrderBy.mockResolvedValue([]);
    const res = await readByChapter("proj-1", 42);
    expect(res).toEqual({ ok: true, data: [] });
  });
});

// ── list ──────────────────────────────────────────────────────────────────────

describe("list", () => {
  it("returns all review docs ordered by createdAt desc", async () => {
    const docs = [
      { id: "d2", createdAt: new Date("2024-02-01") },
      { id: "d1", createdAt: new Date("2024-01-01") },
    ];
    mockSelectOrderBy.mockResolvedValue(docs);
    const res = await list("proj-1");
    expect(res).toEqual({ ok: true, data: docs });
  });
});

// ── isChapterPassed ───────────────────────────────────────────────────────────

describe("isChapterPassed", () => {
  it("returns passed=true and completedRounds=4 when all 4 rounds pass", async () => {
    const rows = [1, 2, 3, 4].map((r) => ({
      id: `doc-${r}`,
      metadata: { chapterNumber: 1, round: r, passed: true },
    }));
    mockSelectOrderBy.mockResolvedValue(rows);
    const res = await isChapterPassed("proj-1", 1);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.passed).toBe(true);
      expect(res.data.completedRounds).toBe(4);
    }
  });

  it("returns passed=false and completedRounds=2 when only 2 rounds complete", async () => {
    const rows = [1, 2].map((r) => ({
      id: `doc-${r}`,
      metadata: { chapterNumber: 1, round: r, passed: true },
    }));
    mockSelectOrderBy.mockResolvedValue(rows);
    const res = await isChapterPassed("proj-1", 1);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.passed).toBe(false);
      expect(res.data.completedRounds).toBe(2);
    }
  });

  it("returns passed=false when one round failed", async () => {
    const rows = [
      { id: "d1", metadata: { chapterNumber: 1, round: 1, passed: true } },
      { id: "d2", metadata: { chapterNumber: 1, round: 2, passed: false } },
      { id: "d3", metadata: { chapterNumber: 1, round: 3, passed: true } },
      { id: "d4", metadata: { chapterNumber: 1, round: 4, passed: true } },
    ];
    mockSelectOrderBy.mockResolvedValue(rows);
    const res = await isChapterPassed("proj-1", 1);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.passed).toBe(false);
      expect(res.data.completedRounds).toBe(4);
    }
  });

  it("returns passed=false and completedRounds=0 for chapter with no reviews", async () => {
    mockSelectOrderBy.mockResolvedValue([]);
    const res = await isChapterPassed("proj-1", 99);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.passed).toBe(false);
      expect(res.data.completedRounds).toBe(0);
    }
  });
});
