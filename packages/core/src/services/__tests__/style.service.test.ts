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

import { create, read, readByStyleId, list, update } from "../style.service.js";

beforeEach(() => { vi.clearAllMocks(); });

describe("style.service", () => {
  describe("create", () => {
    it("creates style config", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "style-1" }]);
      const result = await create({ styleId: "剑心", displayName: "执笔·剑心", source: "builtin" });
      expect(result).toEqual({ ok: true, data: { id: "style-1" } });
    });
  });

  describe("read", () => {
    it("returns style by id", async () => {
      const style = { id: "style-1", styleId: "剑心" };
      mockSelectLimit.mockResolvedValue([style]);
      const result = await read("style-1");
      expect(result).toEqual({ ok: true, data: style });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await read("nonexistent");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("readByStyleId", () => {
    it("finds style by styleId", async () => {
      const style = { id: "style-1", styleId: "云墨" };
      mockSelectLimit.mockResolvedValue([style]);
      const result = await readByStyleId("云墨");
      expect(result).toEqual({ ok: true, data: style });
    });
  });

  describe("list", () => {
    it("returns active styles", async () => {
      const styles = [{ id: "s1" }, { id: "s2" }];
      mockSelectOrderBy.mockResolvedValue(styles);
      const result = await list();
      expect(result).toEqual({ ok: true, data: styles });
    });
  });

  describe("update", () => {
    it("updates style config", async () => {
      const updated = { id: "style-1", description: "新描述" };
      mockUpdateReturning.mockResolvedValue([updated]);
      const result = await update("style-1", { description: "新描述" });
      expect(result).toEqual({ ok: true, data: updated });
    });
  });
});
