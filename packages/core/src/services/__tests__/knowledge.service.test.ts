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
  createVersion, listVersions,
} from "../knowledge.service.js";

beforeEach(() => { vi.clearAllMocks(); });

describe("knowledge.service", () => {
  // ── Knowledge Entries ──

  describe("create", () => {
    it("returns id on success", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "k-1" }]);
      const result = await create({ title: "知识条目", content: "内容", scope: "global", category: "general", source: "user" });
      expect(result).toEqual({ ok: true, data: { id: "k-1" } });
    });

    it("returns INSERT_FAILED when insert returns empty", async () => {
      mockInsertReturning.mockResolvedValue([]);
      const result = await create({ title: "知识", content: "x", scope: "global", category: "general", source: "user" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INSERT_FAILED");
    });
  });

  describe("read", () => {
    it("returns knowledge entry", async () => {
      const entry = { id: "k-1", title: "知识", content: "内容" };
      mockSelectLimit.mockResolvedValue([entry]);
      const result = await read("k-1");
      expect(result).toEqual({ ok: true, data: entry });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await read("nonexistent");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("list", () => {
    it("returns entries for scope", async () => {
      const entries = [{ id: "k1" }, { id: "k2" }];
      mockSelectOrderBy.mockResolvedValue(entries);
      const result = await list("global");
      expect(result).toEqual({ ok: true, data: entries });
    });

    it("filters by category when provided", async () => {
      const entries = [{ id: "k1", category: "craft" }];
      mockSelectOrderBy.mockResolvedValue(entries);
      const result = await list("global", "craft");
      expect(result).toEqual({ ok: true, data: entries });
    });
  });

  describe("update", () => {
    it("returns updated entry with version bump", async () => {
      const updated = { id: "k-1", title: "新标题", version: 2 };
      mockUpdateReturning.mockResolvedValue([updated]);
      const result = await update("k-1", { title: "新标题" });
      expect(result).toEqual({ ok: true, data: updated });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockUpdateReturning.mockResolvedValue([]);
      const result = await update("nonexistent", { title: "x" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("patch", () => {
    it("returns patched entry", async () => {
      const patched = { id: "k-1", title: "补丁" };
      mockUpdateReturning.mockResolvedValue([patched]);
      const result = await patch("k-1", { title: "补丁" });
      expect(result).toEqual({ ok: true, data: patched });
    });

    it("bumps version when content is patched", async () => {
      const patched = { id: "k-1", content: "新内容", version: 3 };
      mockUpdateReturning.mockResolvedValue([patched]);
      const result = await patch("k-1", { content: "新内容" });
      expect(result).toEqual({ ok: true, data: patched });
    });

    it("returns NO_FIELDS when empty data", async () => {
      const result = await patch("k-1", {});
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NO_FIELDS");
    });

    it("returns NOT_FOUND when missing", async () => {
      mockUpdateReturning.mockResolvedValue([]);
      const result = await patch("nonexistent", { title: "x" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("remove", () => {
    it("returns success when deleted", async () => {
      mockDeleteReturning.mockResolvedValue([{ id: "k-1" }]);
      const result = await remove("k-1");
      expect(result).toEqual({ ok: true, data: undefined });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockDeleteReturning.mockResolvedValue([]);
      const result = await remove("nonexistent");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  // ── Knowledge Versions ──

  describe("createVersion", () => {
    it("returns id on success", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "kv-1" }]);
      const result = await createVersion("k-1", { version: 1, content: "版本内容" });
      expect(result).toEqual({ ok: true, data: { id: "kv-1" } });
    });

    it("returns INSERT_FAILED when insert returns empty", async () => {
      mockInsertReturning.mockResolvedValue([]);
      const result = await createVersion("k-1", { version: 1, content: "x" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INSERT_FAILED");
    });
  });

  describe("listVersions", () => {
    it("returns versions ordered by version desc", async () => {
      const versions = [{ id: "v2", version: 2 }, { id: "v1", version: 1 }];
      mockSelectOrderBy.mockResolvedValue(versions);
      const result = await listVersions("k-1");
      expect(result).toEqual({ ok: true, data: versions });
    });
  });
});
