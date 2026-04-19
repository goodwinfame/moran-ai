import { describe, expect, it, vi, beforeEach } from "vitest";

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

import {
  createChapterSummary, readChapterSummary, listChapterSummaries,
  createArcSummary, readArcSummary, listArcSummaries,
} from "../summary.service.js";

beforeEach(() => { vi.clearAllMocks(); });

describe("summary.service", () => {
  // ── Chapter Summaries ──

  describe("createChapterSummary", () => {
    it("returns id on success", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "cs-1" }]);
      const result = await createChapterSummary("proj-1", { chapterNumber: 1, content: "摘要" });
      expect(result).toEqual({ ok: true, data: { id: "cs-1" } });
    });

    it("returns INSERT_FAILED when insert returns empty", async () => {
      mockInsertReturning.mockResolvedValue([]);
      const result = await createChapterSummary("proj-1", { chapterNumber: 1, content: "x" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INSERT_FAILED");
    });
  });

  describe("readChapterSummary", () => {
    it("returns summary data", async () => {
      const summary = { id: "cs-1", chapterNumber: 1, content: "摘要" };
      mockSelectLimit.mockResolvedValue([summary]);
      const result = await readChapterSummary("proj-1", 1);
      expect(result).toEqual({ ok: true, data: summary });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await readChapterSummary("proj-1", 99);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("listChapterSummaries", () => {
    it("returns all chapter summaries for project", async () => {
      const summaries = [{ id: "cs-1", chapterNumber: 1 }, { id: "cs-2", chapterNumber: 2 }];
      mockSelectOrderBy.mockResolvedValue(summaries);
      const result = await listChapterSummaries("proj-1");
      expect(result).toEqual({ ok: true, data: summaries });
    });
  });

  // ── Arc Summaries ──

  describe("createArcSummary", () => {
    it("returns id on success", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "as-1" }]);
      const result = await createArcSummary("proj-1", { arcIndex: 1, content: "弧段摘要" });
      expect(result).toEqual({ ok: true, data: { id: "as-1" } });
    });

    it("returns INSERT_FAILED when insert returns empty", async () => {
      mockInsertReturning.mockResolvedValue([]);
      const result = await createArcSummary("proj-1", { arcIndex: 1, content: "x" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INSERT_FAILED");
    });
  });

  describe("readArcSummary", () => {
    it("returns arc summary data", async () => {
      const summary = { id: "as-1", arcIndex: 1, content: "弧段摘要" };
      mockSelectLimit.mockResolvedValue([summary]);
      const result = await readArcSummary("proj-1", 1);
      expect(result).toEqual({ ok: true, data: summary });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await readArcSummary("proj-1", 99);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("listArcSummaries", () => {
    it("returns all arc summaries for project", async () => {
      const summaries = [{ id: "as-1", arcIndex: 1 }, { id: "as-2", arcIndex: 2 }];
      mockSelectOrderBy.mockResolvedValue(summaries);
      const result = await listArcSummaries("proj-1");
      expect(result).toEqual({ ok: true, data: summaries });
    });
  });
});
