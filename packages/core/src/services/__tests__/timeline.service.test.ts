import { describe, expect, it, vi, beforeEach } from "vitest";

const mockSelectLimit = vi.fn();
const mockSelectOrderBy = vi.fn();
const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit, orderBy: mockSelectOrderBy }));
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere, orderBy: mockSelectOrderBy }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));
const mockInsertReturning = vi.fn();
const mockInsert = vi.fn(() => ({ values: vi.fn(() => ({ returning: mockInsertReturning })) }));

vi.mock("../../db/index.js", () => ({
  getDb: () => ({ select: mockSelect, insert: mockInsert }),
}));

import { create, read, list } from "../timeline.service.js";

beforeEach(() => { vi.clearAllMocks(); });

describe("timeline.service", () => {
  describe("create", () => {
    it("returns id on success", async () => {
      mockInsertReturning.mockResolvedValue([{ id: "ev-1" }]);
      const result = await create("proj-1", { chapterNumber: 1, content: "事件发生" });
      expect(result).toEqual({ ok: true, data: { id: "ev-1" } });
    });

    it("returns INSERT_FAILED when insert returns empty", async () => {
      mockInsertReturning.mockResolvedValue([]);
      const result = await create("proj-1", { chapterNumber: 1, content: "x" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INSERT_FAILED");
    });
  });

  describe("read", () => {
    it("returns timeline event data", async () => {
      const event = { id: "ev-1", chapterNumber: 1, content: "事件" };
      mockSelectLimit.mockResolvedValue([event]);
      const result = await read("proj-1", "ev-1");
      expect(result).toEqual({ ok: true, data: event });
    });

    it("returns NOT_FOUND when missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await read("proj-1", "nonexistent");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("list", () => {
    it("returns all events for project", async () => {
      const events = [{ id: "e1" }, { id: "e2" }];
      mockSelectOrderBy.mockResolvedValue(events);
      const result = await list("proj-1");
      expect(result).toEqual({ ok: true, data: events });
    });

    it("filters by chapterNumber when provided", async () => {
      const events = [{ id: "e1", chapterNumber: 3 }];
      mockSelectOrderBy.mockResolvedValue(events);
      const result = await list("proj-1", 3);
      expect(result).toEqual({ ok: true, data: events });
    });
  });
});
