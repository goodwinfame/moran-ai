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
const mockDeleteReturning = vi.fn();
const mockDelete = vi.fn(() => ({ where: vi.fn(() => ({ returning: mockDeleteReturning })) }));

vi.mock("../../db/index.js", () => ({
  getDb: () => ({ select: mockSelect, insert: mockInsert, update: mockUpdate, delete: mockDelete }),
}));

import {
  create, read, list, update, patch, remove,
  createDna, readDna, updateDna,
  createState, readState, listStates,
} from "../character.service.js";

beforeEach(() => { vi.clearAllMocks(); });

describe("character.service", () => {
  describe("create", () => {
    it("returns id on success", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "char-1" }]);
      const result = await create("proj-1", { name: "张三" });
      expect(result).toEqual({ ok: true, data: { id: "char-1" } });
    });

    it("returns INSERT_FAILED when insert returns empty", async () => {
      mockInsertReturning.mockResolvedValue([]);
      const result = await create("proj-1", { name: "张三" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INSERT_FAILED");
    });
  });

  describe("read", () => {
    it("returns character data", async () => {
      const char = { id: "char-1", name: "张三", projectId: "proj-1" };
      mockSelectLimit.mockResolvedValue([char]);
      const result = await read("proj-1", "char-1");
      expect(result).toEqual({ ok: true, data: char });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await read("proj-1", "nonexistent");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("list", () => {
    it("returns all characters for project", async () => {
      const chars = [{ id: "c1" }, { id: "c2" }];
      mockSelectOrderBy.mockResolvedValue(chars);
      const result = await list("proj-1");
      expect(result).toEqual({ ok: true, data: chars });
    });
  });

  describe("update", () => {
    it("returns updated character", async () => {
      const updated = { id: "char-1", name: "李四" };
      mockUpdateReturning.mockResolvedValue([updated]);
      const result = await update("char-1", { name: "李四" });
      expect(result).toEqual({ ok: true, data: updated });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockUpdateReturning.mockResolvedValue([]);
      const result = await update("nonexistent", { name: "李四" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("patch", () => {
    it("returns patched character", async () => {
      const patched = { id: "char-1", name: "王五" };
      mockUpdateReturning.mockResolvedValue([patched]);
      const result = await patch("char-1", { name: "王五" });
      expect(result).toEqual({ ok: true, data: patched });
    });

    it("returns NO_FIELDS when empty data", async () => {
      const result = await patch("char-1", {});
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NO_FIELDS");
    });

    it("returns NOT_FOUND when missing", async () => {
      mockUpdateReturning.mockResolvedValue([]);
      const result = await patch("nonexistent", { name: "王五" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("remove", () => {
    it("returns success when deleted", async () => {
      mockDeleteReturning.mockResolvedValue([{ id: "char-1" }]);
      const result = await remove("char-1");
      expect(result).toEqual({ ok: true, data: undefined });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockDeleteReturning.mockResolvedValue([]);
      const result = await remove("nonexistent");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("createDna", () => {
    it("returns id on success", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "dna-1" }]);
      const result = await createDna("char-1", { ghost: "创伤", wound: "伤痕", lie: "谎言", want: "欲望", need: "需求" });
      expect(result).toEqual({ ok: true, data: { id: "dna-1" } });
    });

    it("returns INSERT_FAILED when insert returns empty", async () => {
      mockInsertReturning.mockResolvedValue([]);
      const result = await createDna("char-1", { ghost: "创伤" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INSERT_FAILED");
    });
  });

  describe("readDna", () => {
    it("returns DNA data", async () => {
      const dna = { id: "dna-1", characterId: "char-1", ghost: "创伤" };
      mockSelectLimit.mockResolvedValue([dna]);
      const result = await readDna("char-1");
      expect(result).toEqual({ ok: true, data: dna });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await readDna("nonexistent");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("updateDna", () => {
    it("returns updated DNA", async () => {
      const updated = { id: "dna-1", ghost: "新创伤" };
      mockUpdateReturning.mockResolvedValue([updated]);
      const result = await updateDna("char-1", { ghost: "新创伤" });
      expect(result).toEqual({ ok: true, data: updated });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockUpdateReturning.mockResolvedValue([]);
      const result = await updateDna("nonexistent", { ghost: "x" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("createState", () => {
    it("returns id on success", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "state-1" }]);
      const result = await createState("char-1", { chapterNumber: 1 });
      expect(result).toEqual({ ok: true, data: { id: "state-1" } });
    });

    it("returns INSERT_FAILED when insert returns empty", async () => {
      mockInsertReturning.mockResolvedValue([]);
      const result = await createState("char-1", { chapterNumber: 1 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INSERT_FAILED");
    });
  });

  describe("readState", () => {
    it("returns state for chapter", async () => {
      const state = { id: "state-1", characterId: "char-1", chapterNumber: 1 };
      mockSelectLimit.mockResolvedValue([state]);
      const result = await readState("char-1", 1);
      expect(result).toEqual({ ok: true, data: state });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await readState("char-1", 99);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("listStates", () => {
    it("returns all states for character", async () => {
      const states = [{ id: "s1", chapterNumber: 1 }, { id: "s2", chapterNumber: 2 }];
      mockSelectOrderBy.mockResolvedValue(states);
      const result = await listStates("char-1");
      expect(result).toEqual({ ok: true, data: states });
    });
  });
});
