import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockServer, parseResponse } from "../helpers.js";

const { mockCharacterCreate, mockCharacterRead, mockCharacterList, mockCharacterUpdate, mockCharacterRemove, mockCharacterPatch } = vi.hoisted(() => ({
  mockCharacterCreate: vi.fn(),
  mockCharacterRead: vi.fn(),
  mockCharacterList: vi.fn(),
  mockCharacterUpdate: vi.fn(),
  mockCharacterRemove: vi.fn(),
  mockCharacterPatch: vi.fn(),
}));
vi.mock("@moran/core/services", () => ({
  characterService: {
    create: mockCharacterCreate,
    read: mockCharacterRead,
    list: mockCharacterList,
    update: mockCharacterUpdate,
    remove: mockCharacterRemove,
    patch: mockCharacterPatch,
  },
}));

const { mockCheckPrerequisites, mockToGateDetails } = vi.hoisted(() => ({
  mockCheckPrerequisites: vi.fn(),
  mockToGateDetails: vi.fn(),
}));
vi.mock("../../gates/checker.js", () => ({
  checkPrerequisites: mockCheckPrerequisites,
  toGateDetails: mockToGateDetails,
}));

vi.mock("../../utils/patch.js", () => ({
  applyPatches: vi.fn(),
}));

import { registerCharacterTools } from "../../tools/character.js";
import { applyPatches } from "../../utils/patch.js";

const mockApplyPatches = vi.mocked(applyPatches);

describe("character tools", () => {
  const { server, handlers } = createMockServer();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPrerequisites.mockResolvedValue({ passed: true, conditions: [] });
  });

  registerCharacterTools(server);

  describe("character_create", () => {
    it("creates character when gate passes", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true });
      const char = { id: "c-1", name: "Hero", role: "protagonist" };
      mockCharacterCreate.mockResolvedValue({ ok: true, data: char });

      const result = await handlers.get("character_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        name: "Hero",
        role: "protagonist",
        designDepth: "core",
        profile: '{"personality":"brave"}',
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(char);
    });

    it("maps designDepth to designTier and profile to profileContent", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true });
      mockCharacterCreate.mockResolvedValue({ ok: true, data: { id: "c-1" } });

      await handlers.get("character_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        name: "Hero",
        role: "protagonist",
        designDepth: "core",
        profile: '{"personality":"brave"}',
      });

      expect(mockCharacterCreate).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        {
          name: "Hero",
          role: "protagonist",
          designTier: "core",
          profileContent: '{"personality":"brave"}',
        },
      );
    });

    it("returns GATE_FAILED when prerequisites not met", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: false });
      mockToGateDetails.mockReturnValue({ passed: [], failed: ["world_design"], suggestions: [] });

      const result = await handlers.get("character_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        name: "Hero",
        role: "protagonist",
        designDepth: "core",
        profile: "{}",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("GATE_FAILED");
    });

    it("returns error when service create fails", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true });
      mockCharacterCreate.mockResolvedValue({
        ok: false,
        error: { code: "CONFLICT", message: "Already exists" },
      });

      const result = await handlers.get("character_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        name: "Hero",
        role: "protagonist",
        designDepth: "core",
        profile: "{}",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("CONFLICT");
    });
  });

  describe("character_read", () => {
    it("reads single character when characterId is provided", async () => {
      const char = { id: "c-1", name: "Hero" };
      mockCharacterRead.mockResolvedValue({ ok: true, data: char });

      const result = await handlers.get("character_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(char);
      expect(mockCharacterRead).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
      );
      expect(mockCharacterList).not.toHaveBeenCalled();
    });

    it("lists all characters when no characterId", async () => {
      const chars = [
        { id: "c-1", role: "protagonist", designTier: "core" },
        { id: "c-2", role: "supporting", designTier: "important" },
      ];
      mockCharacterList.mockResolvedValue({ ok: true, data: chars });

      const result = await handlers.get("character_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(chars);
    });

    it("filters by role", async () => {
      const chars = [
        { id: "c-1", role: "protagonist", designTier: "core" },
        { id: "c-2", role: "supporting", designTier: "important" },
      ];
      mockCharacterList.mockResolvedValue({ ok: true, data: chars });

      const result = await handlers.get("character_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        role: "protagonist",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual([{ id: "c-1", role: "protagonist", designTier: "core" }]);
    });

    it("filters by designDepth (maps to designTier)", async () => {
      const chars = [
        { id: "c-1", role: "protagonist", designTier: "core" },
        { id: "c-2", role: "supporting", designTier: "important" },
      ];
      mockCharacterList.mockResolvedValue({ ok: true, data: chars });

      const result = await handlers.get("character_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        designDepth: "core",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual([{ id: "c-1", role: "protagonist", designTier: "core" }]);
    });

    it("returns error when list fails", async () => {
      mockCharacterList.mockResolvedValue({
        ok: false,
        error: { code: "INTERNAL", message: "DB error" },
      });

      const result = await handlers.get("character_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("INTERNAL");
    });
  });

  describe("character_update", () => {
    it("updates character and returns data", async () => {
      const updated = { id: "c-1", name: "Updated Hero" };
      mockCharacterUpdate.mockResolvedValue({ ok: true, data: updated });

      const result = await handlers.get("character_update")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
        name: "Updated Hero",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(updated);
    });

    it("maps designDepth to designTier and profile to profileContent", async () => {
      mockCharacterUpdate.mockResolvedValue({ ok: true, data: {} });

      await handlers.get("character_update")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
        designDepth: "important",
        profile: '{"personality":"wise"}',
      });

      expect(mockCharacterUpdate).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000002",
        expect.objectContaining({
          designTier: "important",
          profileContent: '{"personality":"wise"}',
        }),
      );
    });

    it("returns error when update fails", async () => {
      mockCharacterUpdate.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Not found" },
      });

      const result = await handlers.get("character_update")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });
  });

  describe("character_delete", () => {
    it("deletes character and returns id", async () => {
      mockCharacterRemove.mockResolvedValue({ ok: true, data: null });

      const result = await handlers.get("character_delete")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect((payload.data as Record<string, unknown>).id).toBe("00000000-0000-0000-0000-000000000002");
    });

    it("returns error when delete fails", async () => {
      mockCharacterRemove.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Not found" },
      });

      const result = await handlers.get("character_delete")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });

    it("includes warnings when soft gate triggered (character in archived chapters)", async () => {
      mockCheckPrerequisites.mockResolvedValue({
        passed: true,
        conditions: [
          {
            description: "该角色未在已归档章节中出场",
            level: "SOFT",
            met: false,
            suggestion: "该角色在已归档章节中出场，删除可能影响一致性",
          },
        ],
      });
      mockCharacterRemove.mockResolvedValue({ ok: true, data: undefined });

      const result = await handlers.get("character_delete")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      const data = payload.data as Record<string, unknown>;
      expect(data.id).toBe("00000000-0000-0000-0000-000000000002");
      expect(data.warnings).toEqual(["该角色在已归档章节中出场，删除可能影响一致性"]);
    });

    it("returns no warnings when soft gate passes (character not in archived chapters)", async () => {
      mockCheckPrerequisites.mockResolvedValue({
        passed: true,
        conditions: [
          {
            description: "该角色未在已归档章节中出场",
            level: "SOFT",
            met: true,
          },
        ],
      });
      mockCharacterRemove.mockResolvedValue({ ok: true, data: undefined });

      const result = await handlers.get("character_delete")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      const data = payload.data as Record<string, unknown>;
      expect(data.warnings).toBeUndefined();
    });
  });

  describe("character_patch", () => {
    it("applies patches to profileContent and returns applied count", async () => {
      const char = { id: "c-1", profileContent: "brave hero" };
      mockCharacterRead.mockResolvedValue({ ok: true, data: char });
      mockApplyPatches.mockReturnValue({ content: "wise hero", applied: 1, failed: [] });
      mockCharacterPatch.mockResolvedValue({ ok: true, data: {} });

      const result = await handlers.get("character_patch")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
        patches: [{ find: "brave", replace: "wise" }],
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect((payload.data as Record<string, unknown>).appliedCount).toBe(1);
    });

    it("uses empty string when profileContent is null", async () => {
      const char = { id: "c-1", profileContent: null };
      mockCharacterRead.mockResolvedValue({ ok: true, data: char });
      mockApplyPatches.mockReturnValue({ content: "new", applied: 1, failed: [] });
      mockCharacterPatch.mockResolvedValue({ ok: true, data: {} });

      await handlers.get("character_patch")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
        patches: [{ find: "", replace: "new" }],
      });

      expect(mockApplyPatches).toHaveBeenCalledWith("", expect.any(Array));
    });

    it("returns NOT_FOUND when read fails", async () => {
      mockCharacterRead.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Not found" },
      });

      const result = await handlers.get("character_patch")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
        patches: [{ find: "x", replace: "y" }],
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });

    it("returns PATCH_NO_MATCH when no patches applied", async () => {
      mockCharacterRead.mockResolvedValue({ ok: true, data: { id: "c-1", profileContent: "text" } });
      mockApplyPatches.mockReturnValue({ content: "text", applied: 0, failed: ["xyz"] });

      const result = await handlers.get("character_patch")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
        patches: [{ find: "xyz", replace: "abc" }],
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("PATCH_NO_MATCH");
    });
  });
});
