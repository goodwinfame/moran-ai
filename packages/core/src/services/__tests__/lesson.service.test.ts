import { describe, expect, it, vi, beforeEach } from "vitest";

const mockSelectLimit = vi.fn();
const mockSelectOrderBy = vi.fn();
const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit, orderBy: mockSelectOrderBy }));
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere, orderBy: mockSelectOrderBy }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));
const mockInsertReturning = vi.fn();
const mockInsert = vi.fn(() => ({ values: vi.fn(() => ({ returning: mockInsertReturning })) }));
const mockUpdateReturning = vi.fn();
const mockUpdate = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockUpdateReturning })) })) }));

vi.mock("../../db/index.js", () => ({
  getDb: () => ({ select: mockSelect, insert: mockInsert, update: mockUpdate }),
}));

import { create, read, list, update } from "../lesson.service.js";

beforeEach(() => { vi.clearAllMocks(); });

describe("lesson.service", () => {
  describe("create", () => {
    it("returns id on success", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "les-1" }]);
      const result = await create("proj-1", { category: "craft", issue: "问题", correction: "修正" });
      expect(result).toEqual({ ok: true, data: { id: "les-1" } });
    });

    it("returns INSERT_FAILED when insert returns empty", async () => {
      mockInsertReturning.mockResolvedValue([]);
      const result = await create("proj-1", { category: "craft", issue: "x", correction: "y" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INSERT_FAILED");
    });
  });

  describe("read", () => {
    it("returns lesson data", async () => {
      const lesson = { id: "les-1", issue: "问题" };
      mockSelectLimit.mockResolvedValue([lesson]);
      const result = await read("proj-1", "les-1");
      expect(result).toEqual({ ok: true, data: lesson });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await read("proj-1", "nonexistent");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("list", () => {
    it("returns all lessons for project", async () => {
      const lessons = [{ id: "l1" }, { id: "l2" }];
      mockSelectOrderBy.mockResolvedValue(lessons);
      const result = await list("proj-1");
      expect(result).toEqual({ ok: true, data: lessons });
    });

    it("filters by status when provided", async () => {
      const lessons = [{ id: "l1", status: "active" }];
      mockSelectOrderBy.mockResolvedValue(lessons);
      const result = await list("proj-1", "active");
      expect(result).toEqual({ ok: true, data: lessons });
    });
  });

  describe("update", () => {
    it("returns updated lesson", async () => {
      const updated = { id: "les-1", issue: "新问题" };
      mockUpdateReturning.mockResolvedValue([updated]);
      const result = await update("les-1", { issue: "新问题" });
      expect(result).toEqual({ ok: true, data: updated });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockUpdateReturning.mockResolvedValue([]);
      const result = await update("nonexistent", { issue: "x" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });
});
