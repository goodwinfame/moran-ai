import { describe, expect, it, vi, beforeEach } from "vitest";

const mockSelectLimit = vi.fn();
const mockSelectOrderBy = vi.fn();
const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit, orderBy: mockSelectOrderBy }));
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere, orderBy: mockSelectOrderBy }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));
const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
const mockUpdateReturning = vi.fn();
const mockUpdate = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockUpdateReturning })) })) }));

vi.mock("../../db/index.js", () => ({
  getDb: () => ({ select: mockSelect, insert: mockInsert, update: mockUpdate }),
}));

import {
  create, read, readById, list, update, patch, archive,
  createVersion, listVersions,
  createBrief, readBrief, updateBrief,
} from "../chapter.service.js";

beforeEach(() => { vi.clearAllMocks(); });

describe("chapter.service", () => {
  // ── Chapters ──

  describe("create", () => {
    it("returns id on success", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "ch-1" }]);
      const result = await create("proj-1", { chapterNumber: 1, title: "第一章" });
      expect(result).toEqual({ ok: true, data: { id: "ch-1" } });
    });

    it("returns INSERT_FAILED when insert returns empty", async () => {
      mockInsertReturning.mockResolvedValue([]);
      const result = await create("proj-1", { chapterNumber: 1 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INSERT_FAILED");
    });
  });

  describe("read", () => {
    it("returns chapter by projectId + chapterNumber", async () => {
      const ch = { id: "ch-1", chapterNumber: 1, title: "第一章" };
      mockSelectLimit.mockResolvedValue([ch]);
      const result = await read("proj-1", 1);
      expect(result).toEqual({ ok: true, data: ch });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await read("proj-1", 99);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("readById", () => {
    it("returns chapter by id", async () => {
      const ch = { id: "ch-1", chapterNumber: 1 };
      mockSelectLimit.mockResolvedValue([ch]);
      const result = await readById("ch-1");
      expect(result).toEqual({ ok: true, data: ch });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await readById("nonexistent");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("list", () => {
    it("returns all chapters for project", async () => {
      const chapters = [{ id: "c1", chapterNumber: 1 }, { id: "c2", chapterNumber: 2 }];
      mockSelectOrderBy.mockResolvedValue(chapters);
      const result = await list("proj-1");
      expect(result).toEqual({ ok: true, data: chapters });
    });
  });

  describe("update", () => {
    it("returns updated chapter", async () => {
      const updated = { id: "ch-1", title: "新标题" };
      mockUpdateReturning.mockResolvedValue([updated]);
      const result = await update("ch-1", { title: "新标题" });
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
    it("returns patched chapter", async () => {
      const patched = { id: "ch-1", title: "补丁" };
      mockUpdateReturning.mockResolvedValue([patched]);
      const result = await patch("ch-1", { title: "补丁" });
      expect(result).toEqual({ ok: true, data: patched });
    });

    it("returns NO_FIELDS when empty data", async () => {
      const result = await patch("ch-1", {});
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

  describe("archive", () => {
    it("saves version snapshot and sets status to archived", async () => {
      const chapter = { id: "ch-1", content: "章节内容", currentVersion: 2, wordCount: 100 };
      mockSelectLimit.mockResolvedValue([chapter]);
      mockUpdateReturning.mockResolvedValue([{ ...chapter, status: "archived", archivedVersion: 2 }]);
      const result = await archive("ch-1");
      expect(result.ok).toBe(true);
      expect(mockInsert).toHaveBeenCalled();
    });

    it("skips version save when content is null", async () => {
      const chapter = { id: "ch-1", content: null, currentVersion: 1, wordCount: 0 };
      mockSelectLimit.mockResolvedValue([chapter]);
      mockUpdateReturning.mockResolvedValue([{ ...chapter, status: "archived" }]);
      const result = await archive("ch-1");
      expect(result.ok).toBe(true);
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("returns NOT_FOUND when chapter missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await archive("nonexistent");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("returns UPDATE_FAILED when update returns empty", async () => {
      const chapter = { id: "ch-1", content: "内容", currentVersion: 1, wordCount: 50 };
      mockSelectLimit.mockResolvedValue([chapter]);
      mockUpdateReturning.mockResolvedValue([]);
      const result = await archive("ch-1");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("UPDATE_FAILED");
    });
  });

  // ── Chapter Versions ──

  describe("createVersion", () => {
    it("returns id on success", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "ver-1" }]);
      const result = await createVersion("ch-1", { version: 1, content: "内容", wordCount: 100 });
      expect(result).toEqual({ ok: true, data: { id: "ver-1" } });
    });

    it("returns INSERT_FAILED when insert returns empty", async () => {
      mockInsertReturning.mockResolvedValue([]);
      const result = await createVersion("ch-1", { version: 1, content: "x" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INSERT_FAILED");
    });
  });

  describe("listVersions", () => {
    it("returns versions ordered by version desc", async () => {
      const versions = [{ id: "v2", version: 2 }, { id: "v1", version: 1 }];
      mockSelectOrderBy.mockResolvedValue(versions);
      const result = await listVersions("ch-1");
      expect(result).toEqual({ ok: true, data: versions });
    });
  });

  // ── Chapter Briefs ──

  describe("createBrief", () => {
    it("returns id on success", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "brief-1" }]);
      const result = await createBrief("proj-1", { chapterNumber: 1, content: "详案内容" });
      expect(result).toEqual({ ok: true, data: { id: "brief-1" } });
    });

    it("returns INSERT_FAILED when insert returns empty", async () => {
      mockInsertReturning.mockResolvedValue([]);
      const result = await createBrief("proj-1", { chapterNumber: 1, content: "x" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INSERT_FAILED");
    });
  });

  describe("readBrief", () => {
    it("returns brief for chapter", async () => {
      const brief = { id: "brief-1", chapterNumber: 1, content: "详案" };
      mockSelectLimit.mockResolvedValue([brief]);
      const result = await readBrief("proj-1", 1);
      expect(result).toEqual({ ok: true, data: brief });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await readBrief("proj-1", 99);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("updateBrief", () => {
    it("returns updated brief", async () => {
      const updated = { id: "brief-1", content: "新详案" };
      mockUpdateReturning.mockResolvedValue([updated]);
      const result = await updateBrief("brief-1", { content: "新详案" });
      expect(result).toEqual({ ok: true, data: updated });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockUpdateReturning.mockResolvedValue([]);
      const result = await updateBrief("nonexistent", { content: "x" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });
});
