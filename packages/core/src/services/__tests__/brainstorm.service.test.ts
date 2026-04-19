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

import { create, read, list, update, patch } from "../brainstorm.service.js";

beforeEach(() => { vi.clearAllMocks(); });

describe("brainstorm.service", () => {
  describe("create", () => {
    it("creates brainstorm doc with category", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "doc-1" }]);
      const result = await create("proj-1", { content: "灵感内容" });
      expect(result).toEqual({ ok: true, data: { id: "doc-1" } });
    });
  });

  describe("read", () => {
    it("returns single doc by id", async () => {
      const doc = { id: "doc-1", content: "灵感", category: "brainstorm" };
      mockSelectLimit.mockResolvedValue([doc]);
      const result = await read("proj-1", "doc-1");
      expect(result).toEqual({ ok: true, data: doc });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await read("proj-1", "nonexistent");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("list", () => {
    it("returns all brainstorm docs", async () => {
      const docs = [{ id: "d1" }, { id: "d2" }];
      mockSelectOrderBy.mockResolvedValue(docs);
      const result = await list("proj-1");
      expect(result).toEqual({ ok: true, data: docs });
    });
  });

  describe("update", () => {
    it("updates and bumps version", async () => {
      const updated = { id: "doc-1", content: "新内容", version: 2 };
      mockUpdateReturning.mockResolvedValue([updated]);
      const result = await update("doc-1", { content: "新内容" });
      expect(result).toEqual({ ok: true, data: updated });
    });
  });

  describe("patch", () => {
    it("only updates provided fields", async () => {
      const patched = { id: "doc-1", isPinned: true };
      mockUpdateReturning.mockResolvedValue([patched]);
      const result = await patch("doc-1", { isPinned: true });
      expect(result).toEqual({ ok: true, data: patched });
    });

    it("returns NO_FIELDS when no data provided", async () => {
      const result = await patch("doc-1", {});
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NO_FIELDS");
    });

    it("returns NOT_FOUND when doc missing", async () => {
      mockUpdateReturning.mockResolvedValue([]);
      const result = await patch("doc-1", { content: "new" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });
});
