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
  createSetting, readSetting, listSettings, updateSetting, patchSetting, removeSetting,
  createState, readState, listStates,
} from "../world.service.js";

beforeEach(() => { vi.clearAllMocks(); });

describe("world.service", () => {
  describe("createSetting", () => {
    it("creates world setting", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "ws-1" }]);
      const result = await createSetting("proj-1", { section: "power_system", content: "描述" });
      expect(result).toEqual({ ok: true, data: { id: "ws-1" } });
    });
  });

  describe("readSetting", () => {
    it("returns NOT_FOUND when missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await readSetting("proj-1", "nonexistent");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("listSettings", () => {
    it("returns settings filtered by section", async () => {
      const settings = [{ id: "ws-1", section: "geography" }];
      mockSelectOrderBy.mockResolvedValue(settings);
      const result = await listSettings("proj-1", "geography");
      expect(result).toEqual({ ok: true, data: settings });
    });
  });

  describe("patchSetting", () => {
    it("returns NO_FIELDS when empty data", async () => {
      const result = await patchSetting("ws-1", {});
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NO_FIELDS");
    });

    it("updates only provided fields", async () => {
      const patched = { id: "ws-1", content: "新内容" };
      mockUpdateReturning.mockResolvedValue([patched]);
      const result = await patchSetting("ws-1", { content: "新内容" });
      expect(result).toEqual({ ok: true, data: patched });
    });
  });

  describe("removeSetting", () => {
    it("deletes setting", async () => {
      mockDeleteReturning.mockResolvedValue([{ id: "ws-1" }]);
      const result = await removeSetting("ws-1");
      expect(result).toEqual({ ok: true, data: undefined });
    });
  });

  describe("createState", () => {
    it("creates world state for chapter", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "wst-1" }]);
      const result = await createState("proj-1", { chapterNumber: 1 });
      expect(result).toEqual({ ok: true, data: { id: "wst-1" } });
    });
  });

  describe("readState", () => {
    it("returns state for chapter", async () => {
      const state = { id: "wst-1", chapterNumber: 1, season: "spring" };
      mockSelectLimit.mockResolvedValue([state]);
      const result = await readState("proj-1", 1);
      expect(result).toEqual({ ok: true, data: state });
    });
  });

  describe("listStates", () => {
    it("returns all states ordered by chapter", async () => {
      const states = [{ chapterNumber: 1 }, { chapterNumber: 2 }];
      mockSelectOrderBy.mockResolvedValue(states);
      const result = await listStates("proj-1");
      expect(result).toEqual({ ok: true, data: states });
    });
  });
});
