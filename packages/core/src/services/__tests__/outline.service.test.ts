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

import {
  createOutline, readOutline, updateOutline, patchOutline,
  createArc, readArc, listArcs, updateArc, patchArc,
} from "../outline.service.js";

beforeEach(() => { vi.clearAllMocks(); });

describe("outline.service", () => {
  // ── Outline ──

  describe("createOutline", () => {
    it("returns id on success", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "out-1" }]);
      const result = await createOutline("proj-1", { synopsis: "大纲概要" });
      expect(result).toEqual({ ok: true, data: { id: "out-1" } });
    });

    it("returns INSERT_FAILED when insert returns empty", async () => {
      mockInsertReturning.mockResolvedValue([]);
      const result = await createOutline("proj-1", {});
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INSERT_FAILED");
    });
  });

  describe("readOutline", () => {
    it("returns outline data", async () => {
      const outline = { id: "out-1", projectId: "proj-1", synopsis: "大纲" };
      mockSelectLimit.mockResolvedValue([outline]);
      const result = await readOutline("proj-1");
      expect(result).toEqual({ ok: true, data: outline });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await readOutline("proj-1");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("updateOutline", () => {
    it("returns updated outline", async () => {
      const updated = { id: "out-1", synopsis: "新大纲" };
      mockUpdateReturning.mockResolvedValue([updated]);
      const result = await updateOutline("proj-1", { synopsis: "新大纲" });
      expect(result).toEqual({ ok: true, data: updated });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockUpdateReturning.mockResolvedValue([]);
      const result = await updateOutline("proj-1", { synopsis: "x" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("patchOutline", () => {
    it("returns patched outline", async () => {
      const patched = { id: "out-1", synopsis: "补丁" };
      mockUpdateReturning.mockResolvedValue([patched]);
      const result = await patchOutline("proj-1", { synopsis: "补丁" });
      expect(result).toEqual({ ok: true, data: patched });
    });

    it("returns NO_FIELDS when empty data", async () => {
      const result = await patchOutline("proj-1", {});
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NO_FIELDS");
    });

    it("returns NOT_FOUND when missing", async () => {
      mockUpdateReturning.mockResolvedValue([]);
      const result = await patchOutline("proj-1", { synopsis: "x" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  // ── Arcs ──

  describe("createArc", () => {
    it("returns id on success", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "arc-1" }]);
      const result = await createArc("proj-1", { arcIndex: 1, title: "第一卷" });
      expect(result).toEqual({ ok: true, data: { id: "arc-1" } });
    });

    it("returns INSERT_FAILED when insert returns empty", async () => {
      mockInsertReturning.mockResolvedValue([]);
      const result = await createArc("proj-1", { arcIndex: 1, title: "第一卷" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INSERT_FAILED");
    });
  });

  describe("readArc", () => {
    it("returns arc data", async () => {
      const arc = { id: "arc-1", arcIndex: 1, title: "第一卷" };
      mockSelectLimit.mockResolvedValue([arc]);
      const result = await readArc("proj-1", 1);
      expect(result).toEqual({ ok: true, data: arc });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await readArc("proj-1", 99);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("listArcs", () => {
    it("returns all arcs for project", async () => {
      const arcList = [{ id: "a1", arcIndex: 1 }, { id: "a2", arcIndex: 2 }];
      mockSelectOrderBy.mockResolvedValue(arcList);
      const result = await listArcs("proj-1");
      expect(result).toEqual({ ok: true, data: arcList });
    });
  });

  describe("updateArc", () => {
    it("returns updated arc", async () => {
      const updated = { id: "arc-1", title: "新卷名" };
      mockUpdateReturning.mockResolvedValue([updated]);
      const result = await updateArc("arc-1", { title: "新卷名" });
      expect(result).toEqual({ ok: true, data: updated });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockUpdateReturning.mockResolvedValue([]);
      const result = await updateArc("nonexistent", { title: "x" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("patchArc", () => {
    it("returns patched arc", async () => {
      const patched = { id: "arc-1", title: "补丁卷" };
      mockUpdateReturning.mockResolvedValue([patched]);
      const result = await patchArc("arc-1", { title: "补丁卷" });
      expect(result).toEqual({ ok: true, data: patched });
    });

    it("returns NO_FIELDS when empty data", async () => {
      const result = await patchArc("arc-1", {});
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NO_FIELDS");
    });

    it("returns NOT_FOUND when missing", async () => {
      mockUpdateReturning.mockResolvedValue([]);
      const result = await patchArc("nonexistent", { title: "x" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });
});
