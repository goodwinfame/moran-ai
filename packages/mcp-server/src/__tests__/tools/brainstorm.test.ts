import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockServer, parseResponse } from "../helpers.js";

const { mockBrainstormCreate, mockBrainstormRead, mockBrainstormList, mockBrainstormUpdate, mockBrainstormPatch } = vi.hoisted(() => ({
  mockBrainstormCreate: vi.fn(),
  mockBrainstormRead: vi.fn(),
  mockBrainstormList: vi.fn(),
  mockBrainstormUpdate: vi.fn(),
  mockBrainstormPatch: vi.fn(),
}));
vi.mock("@moran/core/services", () => ({
  brainstormService: {
    create: mockBrainstormCreate,
    read: mockBrainstormRead,
    list: mockBrainstormList,
    update: mockBrainstormUpdate,
    patch: mockBrainstormPatch,
  },
}));

vi.mock("../../utils/patch.js", () => ({
  applyPatches: vi.fn(),
}));

import { registerBrainstormTools } from "../../tools/brainstorm.js";
import { applyPatches } from "../../utils/patch.js";

const mockApplyPatches = vi.mocked(applyPatches);

describe("brainstorm tools", () => {
  const { server, handlers } = createMockServer();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  registerBrainstormTools(server);

  describe("brainstorm_create", () => {
    it("creates a brainstorm document and returns data", async () => {
      const doc = { id: "bs-1", title: "diverge", content: "{}" };
      mockBrainstormCreate.mockResolvedValue({ ok: true, data: doc });

      const result = await handlers.get("brainstorm_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        type: "diverge",
        content: "{}",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(doc);
      expect(mockBrainstormCreate).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        { title: "diverge", content: "{}", metadata: { type: "diverge" } },
      );
    });

    it("returns error when create fails", async () => {
      mockBrainstormCreate.mockResolvedValue({
        ok: false,
        error: { code: "INTERNAL", message: "DB error" },
      });

      const result = await handlers.get("brainstorm_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        type: "focus",
        content: "{}",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("INTERNAL");
    });
  });

  describe("brainstorm_read", () => {
    it("reads single document when brainstormId is provided", async () => {
      const doc = { id: "bs-1", content: "{}" };
      mockBrainstormRead.mockResolvedValue({ ok: true, data: doc });

      const result = await handlers.get("brainstorm_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        brainstormId: "00000000-0000-0000-0000-000000000002",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(doc);
      expect(mockBrainstormRead).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
      );
      expect(mockBrainstormList).not.toHaveBeenCalled();
    });

    it("lists all documents when no brainstormId", async () => {
      const docs = [
        { id: "bs-1", metadata: { type: "diverge" } },
        { id: "bs-2", metadata: { type: "focus" } },
      ];
      mockBrainstormList.mockResolvedValue({ ok: true, data: docs });

      const result = await handlers.get("brainstorm_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(docs);
    });

    it("filters by type when type is provided", async () => {
      const docs = [
        { id: "bs-1", metadata: { type: "diverge" } },
        { id: "bs-2", metadata: { type: "focus" } },
      ];
      mockBrainstormList.mockResolvedValue({ ok: true, data: docs });

      const result = await handlers.get("brainstorm_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        type: "diverge",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual([{ id: "bs-1", metadata: { type: "diverge" } }]);
    });

    it("returns error when list fails", async () => {
      mockBrainstormList.mockResolvedValue({
        ok: false,
        error: { code: "INTERNAL", message: "DB error" },
      });

      const result = await handlers.get("brainstorm_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("INTERNAL");
    });
  });

  describe("brainstorm_update", () => {
    it("updates document content and returns data", async () => {
      const updated = { id: "bs-1", content: "new content" };
      mockBrainstormUpdate.mockResolvedValue({ ok: true, data: updated });

      const result = await handlers.get("brainstorm_update")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        brainstormId: "00000000-0000-0000-0000-000000000002",
        content: "new content",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(updated);
      expect(mockBrainstormUpdate).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000002",
        { content: "new content" },
      );
    });

    it("returns error when update fails", async () => {
      mockBrainstormUpdate.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Not found" },
      });

      const result = await handlers.get("brainstorm_update")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        brainstormId: "00000000-0000-0000-0000-000000000002",
        content: "x",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });
  });

  describe("brainstorm_patch", () => {
    it("applies patches and returns applied count", async () => {
      const doc = { id: "bs-1", content: "hello world" };
      mockBrainstormRead.mockResolvedValue({ ok: true, data: doc });
      mockApplyPatches.mockReturnValue({ content: "hello earth", applied: 1, failed: [] });
      mockBrainstormPatch.mockResolvedValue({ ok: true, data: { id: "bs-1" } });

      const result = await handlers.get("brainstorm_patch")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        brainstormId: "00000000-0000-0000-0000-000000000002",
        patches: [{ find: "world", replace: "earth" }],
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect((payload.data as Record<string, unknown>).appliedCount).toBe(1);
    });

    it("returns NOT_FOUND when read fails", async () => {
      mockBrainstormRead.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Not found" },
      });

      const result = await handlers.get("brainstorm_patch")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        brainstormId: "00000000-0000-0000-0000-000000000002",
        patches: [{ find: "x", replace: "y" }],
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });

    it("returns PATCH_NO_MATCH when no patches applied", async () => {
      const doc = { id: "bs-1", content: "hello world" };
      mockBrainstormRead.mockResolvedValue({ ok: true, data: doc });
      mockApplyPatches.mockReturnValue({
        content: "hello world",
        applied: 0,
        failed: ["xyz"],
      });

      const result = await handlers.get("brainstorm_patch")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        brainstormId: "00000000-0000-0000-0000-000000000002",
        patches: [{ find: "xyz", replace: "abc" }],
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("PATCH_NO_MATCH");
    });

    it("includes failedPatches in response when some patches fail", async () => {
      const doc = { id: "bs-1", content: "hello world" };
      mockBrainstormRead.mockResolvedValue({ ok: true, data: doc });
      mockApplyPatches.mockReturnValue({
        content: "hello earth",
        applied: 1,
        failed: ["xyz"],
      });
      mockBrainstormPatch.mockResolvedValue({ ok: true, data: {} });

      const result = await handlers.get("brainstorm_patch")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        brainstormId: "00000000-0000-0000-0000-000000000002",
        patches: [
          { find: "world", replace: "earth" },
          { find: "xyz", replace: "abc" },
        ],
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect((payload.data as Record<string, unknown>).failedPatches).toBeDefined();
    });
  });
});
