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

import { create, read, list, update, createState, readStates } from "../relationship.service.js";

beforeEach(() => { vi.clearAllMocks(); });

describe("relationship.service", () => {
  describe("create", () => {
    it("returns id on success", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "rel-1" }]);
      const result = await create("proj-1", { sourceId: "c1", targetId: "c2", type: "ally" });
      expect(result).toEqual({ ok: true, data: { id: "rel-1" } });
    });

    it("returns INSERT_FAILED when insert returns empty", async () => {
      mockInsertReturning.mockResolvedValue([]);
      const result = await create("proj-1", { sourceId: "c1", targetId: "c2", type: "ally" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INSERT_FAILED");
    });
  });

  describe("read", () => {
    it("returns relationship data", async () => {
      const rel = { id: "rel-1", sourceId: "c1", targetId: "c2" };
      mockSelectLimit.mockResolvedValue([rel]);
      const result = await read("proj-1", "rel-1");
      expect(result).toEqual({ ok: true, data: rel });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await read("proj-1", "nonexistent");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("list", () => {
    it("returns relationships for project", async () => {
      const rels = [{ id: "r1" }, { id: "r2" }];
      // relationship.list ends at .where() without .orderBy(), need Promise mock
      mockSelectWhere.mockResolvedValueOnce(rels);
      const result = await list("proj-1");
      expect(result).toEqual({ ok: true, data: rels });
    });

    it("filters by characterId when provided", async () => {
      const rels = [{ id: "r1" }];
      mockSelectWhere.mockResolvedValueOnce(rels);
      const result = await list("proj-1", "char-1");
      expect(result).toEqual({ ok: true, data: rels });
      expect(mockSelectWhere).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("returns updated relationship", async () => {
      const updated = { id: "rel-1", type: "enemy" };
      mockUpdateReturning.mockResolvedValue([updated]);
      const result = await update("rel-1", { type: "enemy" });
      expect(result).toEqual({ ok: true, data: updated });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockUpdateReturning.mockResolvedValue([]);
      const result = await update("nonexistent", { type: "enemy" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("createState", () => {
    it("returns id on success", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "rs-1" }]);
      const result = await createState({ sourceId: "c1", targetId: "c2", chapterNumber: 1 });
      expect(result).toEqual({ ok: true, data: { id: "rs-1" } });
    });

    it("returns INSERT_FAILED when insert returns empty", async () => {
      mockInsertReturning.mockResolvedValue([]);
      const result = await createState({ sourceId: "c1", targetId: "c2", chapterNumber: 1 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INSERT_FAILED");
    });
  });

  describe("readStates", () => {
    it("returns states for a relationship pair", async () => {
      const states = [{ id: "rs-1", chapterNumber: 1 }];
      mockSelectOrderBy.mockResolvedValue(states);
      const result = await readStates("c1", "c2");
      expect(result).toEqual({ ok: true, data: states });
    });

    it("filters by chapterNumber when provided", async () => {
      const states = [{ id: "rs-1", chapterNumber: 3 }];
      mockSelectOrderBy.mockResolvedValue(states);
      const result = await readStates("c1", "c2", 3);
      expect(result).toEqual({ ok: true, data: states });
    });
  });
});
