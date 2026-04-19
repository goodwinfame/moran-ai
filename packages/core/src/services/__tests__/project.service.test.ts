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

import { create, read, list, update, remove } from "../project.service.js";

beforeEach(() => { vi.clearAllMocks(); });

describe("project.service", () => {
  describe("create", () => {
    it("returns id on success", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "proj-1" }]);
      const result = await create({ title: "测试项目", userId: "u-1" });
      expect(result).toEqual({ ok: true, data: { id: "proj-1" } });
    });

    it("returns INSERT_FAILED when insert returns empty", async () => {
      mockInsertReturning.mockResolvedValue([]);
      const result = await create({ title: "测试项目", userId: "u-1" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INSERT_FAILED");
    });
  });

  describe("read", () => {
    it("returns project data", async () => {
      const project = { id: "proj-1", title: "测试项目" };
      mockSelectLimit.mockResolvedValue([project]);
      const result = await read("proj-1");
      expect(result).toEqual({ ok: true, data: project });
    });

    it("returns NOT_FOUND when project missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await read("nonexistent");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("list", () => {
    it("returns all projects for user", async () => {
      const projects = [{ id: "p1" }, { id: "p2" }];
      mockSelectOrderBy.mockResolvedValue(projects);
      const result = await list("u-1");
      expect(result).toEqual({ ok: true, data: projects });
    });
  });

  describe("update", () => {
    it("returns updated project", async () => {
      const updated = { id: "proj-1", title: "新标题" };
      mockUpdateReturning.mockResolvedValue([updated]);
      const result = await update("proj-1", { title: "新标题" });
      expect(result).toEqual({ ok: true, data: updated });
    });

    it("returns NOT_FOUND when project missing", async () => {
      mockUpdateReturning.mockResolvedValue([]);
      const result = await update("nonexistent", { title: "新标题" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("remove", () => {
    it("returns success when deleted", async () => {
      mockDeleteReturning.mockResolvedValue([{ id: "proj-1" }]);
      const result = await remove("proj-1");
      expect(result).toEqual({ ok: true, data: undefined });
    });

    it("returns NOT_FOUND when project missing", async () => {
      mockDeleteReturning.mockResolvedValue([]);
      const result = await remove("nonexistent");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });
});
