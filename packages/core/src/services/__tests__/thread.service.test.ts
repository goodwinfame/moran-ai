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

import { create, read, list, update } from "../thread.service.js";

beforeEach(() => { vi.clearAllMocks(); });

describe("thread.service", () => {
  describe("create", () => {
    it("returns id on success", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "th-1" }]);
      const result = await create("proj-1", { title: "伏笔线索" });
      expect(result).toEqual({ ok: true, data: { id: "th-1" } });
    });

    it("returns INSERT_FAILED when insert returns empty", async () => {
      mockInsertReturning.mockResolvedValue([]);
      const result = await create("proj-1", { title: "伏笔" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INSERT_FAILED");
    });
  });

  describe("read", () => {
    it("returns thread data", async () => {
      const thread = { id: "th-1", title: "伏笔线索" };
      mockSelectLimit.mockResolvedValue([thread]);
      const result = await read("proj-1", "th-1");
      expect(result).toEqual({ ok: true, data: thread });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await read("proj-1", "nonexistent");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("list", () => {
    it("returns all threads for project", async () => {
      const threads = [{ id: "t1" }, { id: "t2" }];
      mockSelectOrderBy.mockResolvedValue(threads);
      const result = await list("proj-1");
      expect(result).toEqual({ ok: true, data: threads });
    });

    it("filters by status when provided", async () => {
      const threads = [{ id: "t1", status: "planted" }];
      mockSelectOrderBy.mockResolvedValue(threads);
      const result = await list("proj-1", "planted");
      expect(result).toEqual({ ok: true, data: threads });
    });
  });

  describe("update", () => {
    it("returns updated thread", async () => {
      const updated = { id: "th-1", title: "新伏笔" };
      mockUpdateReturning.mockResolvedValue([updated]);
      const result = await update("th-1", { title: "新伏笔" });
      expect(result).toEqual({ ok: true, data: updated });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockUpdateReturning.mockResolvedValue([]);
      const result = await update("nonexistent", { title: "x" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });
});
