import { describe, expect, it, vi, beforeEach } from "vitest";

const mockSelectLimit = vi.fn();
const mockSelectOrderBy = vi.fn();
const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit, orderBy: mockSelectOrderBy }));
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere, orderBy: mockSelectOrderBy }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

vi.mock("../../db/index.js", () => ({
  getDb: () => ({ select: mockSelect }),
}));

import { check } from "../gate.service.js";

beforeEach(() => { vi.clearAllMocks(); });

describe("gate.service", () => {
  describe("check", () => {
    it("allows domain at brainstorm status", async () => {
      mockSelectLimit.mockResolvedValue([{ status: "brainstorm" }]);
      const result = await check("proj-1", "brainstorm");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.allowed).toBe(true);
        expect(result.data.projectStatus).toBe("brainstorm");
        expect(result.data.domain).toBe("brainstorm");
      }
    });

    it("blocks chapter domain at brainstorm status", async () => {
      mockSelectLimit.mockResolvedValue([{ status: "brainstorm" }]);
      const result = await check("proj-1", "chapter");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.allowed).toBe(false);
        expect(result.data.domain).toBe("chapter");
      }
    });

    it("allows chapter domain at writing status", async () => {
      mockSelectLimit.mockResolvedValue([{ status: "writing" }]);
      const result = await check("proj-1", "chapter");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.allowed).toBe(true);
      }
    });

    it("allows all domains at completed status", async () => {
      mockSelectLimit.mockResolvedValue([{ status: "completed" }]);
      const result = await check("proj-1", "analysis");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.allowed).toBe(true);
      }
    });

    it("defaults to brainstorm when status is null", async () => {
      mockSelectLimit.mockResolvedValue([{ status: null }]);
      const result = await check("proj-1", "brainstorm");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.allowed).toBe(true);
        expect(result.data.projectStatus).toBe("brainstorm");
      }
    });

    it("returns NOT_FOUND when project missing", async () => {
      mockSelectLimit.mockResolvedValue([]);
      const result = await check("nonexistent", "brainstorm");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("includes allowedDomains in result", async () => {
      mockSelectLimit.mockResolvedValue([{ status: "world" }]);
      const result = await check("proj-1", "world");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.allowedDomains).toContain("world");
        expect(result.data.allowedDomains).toContain("project");
        expect(result.data.allowedDomains).not.toContain("chapter");
      }
    });
  });
});
