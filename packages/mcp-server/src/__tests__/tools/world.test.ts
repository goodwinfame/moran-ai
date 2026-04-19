import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockServer, parseResponse } from "../helpers.js";

const { mockWorldCreateSetting, mockWorldReadSetting, mockWorldListSettings, mockWorldUpdateSetting, mockWorldRemoveSetting } = vi.hoisted(() => ({
  mockWorldCreateSetting: vi.fn(),
  mockWorldReadSetting: vi.fn(),
  mockWorldListSettings: vi.fn(),
  mockWorldUpdateSetting: vi.fn(),
  mockWorldRemoveSetting: vi.fn(),
}));
vi.mock("@moran/core/services", () => ({
  worldService: {
    createSetting: mockWorldCreateSetting,
    readSetting: mockWorldReadSetting,
    listSettings: mockWorldListSettings,
    updateSetting: mockWorldUpdateSetting,
    removeSetting: mockWorldRemoveSetting,
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

import { registerWorldTools } from "../../tools/world.js";
import { applyPatches } from "../../utils/patch.js";

const mockApplyPatches = vi.mocked(applyPatches);

describe("world tools", () => {
  const { server, handlers } = createMockServer();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  registerWorldTools(server);

  describe("world_create", () => {
    it("creates a world setting when gate passes", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true });
      const setting = { id: "w-1", name: "Magic System", section: "subsystem" };
      mockWorldCreateSetting.mockResolvedValue({ ok: true, data: setting });

      const result = await handlers.get("world_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        type: "subsystem",
        name: "Magic System",
        content: "{}",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect((payload.data as Record<string, unknown>).id).toBe("w-1");
      expect((payload.data as Record<string, unknown>).type).toBe("subsystem");
    });

    it("returns GATE_FAILED when prerequisites not met", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: false });
      mockToGateDetails.mockReturnValue({ passed: [], failed: ["brief"], suggestions: [] });

      const result = await handlers.get("world_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        type: "setting",
        name: "World",
        content: "{}",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("GATE_FAILED");
    });

    it("maps type=setting with no section to section=base", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true });
      mockWorldCreateSetting.mockResolvedValue({ ok: true, data: { id: "w-1" } });

      await handlers.get("world_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        type: "setting",
        name: "World",
        content: "{}",
      });

      expect(mockWorldCreateSetting).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        expect.objectContaining({ section: "base" }),
      );
    });

    it("maps type=setting with section=custom to section=custom", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true });
      mockWorldCreateSetting.mockResolvedValue({ ok: true, data: { id: "w-1" } });

      await handlers.get("world_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        type: "setting",
        name: "Custom",
        content: "{}",
        section: "custom",
      });

      expect(mockWorldCreateSetting).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        expect.objectContaining({ section: "custom" }),
      );
    });

    it("maps type=subsystem to section=subsystem", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true });
      mockWorldCreateSetting.mockResolvedValue({ ok: true, data: { id: "w-1" } });

      await handlers.get("world_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        type: "subsystem",
        name: "Power System",
        content: "{}",
      });

      expect(mockWorldCreateSetting).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        expect.objectContaining({ section: "subsystem" }),
      );
    });

    it("returns error when service create fails", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true });
      mockWorldCreateSetting.mockResolvedValue({
        ok: false,
        error: { code: "CONFLICT", message: "Already exists" },
      });

      const result = await handlers.get("world_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        type: "location",
        name: "City",
        content: "{}",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("CONFLICT");
    });
  });

  describe("world_read", () => {
    it("reads single setting when worldId is provided", async () => {
      const setting = { id: "w-1", name: "Magic" };
      mockWorldReadSetting.mockResolvedValue({ ok: true, data: setting });

      const result = await handlers.get("world_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        worldId: "00000000-0000-0000-0000-000000000002",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(setting);
      expect(mockWorldReadSetting).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
      );
    });

    it("lists settings without filter", async () => {
      const settings = [{ id: "w-1" }, { id: "w-2" }];
      mockWorldListSettings.mockResolvedValue({ ok: true, data: settings });

      const result = await handlers.get("world_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(mockWorldListSettings).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        undefined,
      );
    });

    it("filters by type=subsystem resolves to section=subsystem", async () => {
      mockWorldListSettings.mockResolvedValue({ ok: true, data: [] });

      await handlers.get("world_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        type: "subsystem",
      });

      expect(mockWorldListSettings).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        "subsystem",
      );
    });

    it("filters by type=setting resolves to section=base by default", async () => {
      mockWorldListSettings.mockResolvedValue({ ok: true, data: [] });

      await handlers.get("world_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        type: "setting",
      });

      expect(mockWorldListSettings).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        "base",
      );
    });
  });

  describe("world_update", () => {
    it("updates setting and returns data", async () => {
      const updated = { id: "w-1", name: "Updated" };
      mockWorldUpdateSetting.mockResolvedValue({ ok: true, data: updated });

      const result = await handlers.get("world_update")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        worldId: "00000000-0000-0000-0000-000000000002",
        name: "Updated",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(updated);
    });

    it("uses empty string for content when not provided", async () => {
      mockWorldUpdateSetting.mockResolvedValue({ ok: true, data: {} });

      await handlers.get("world_update")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        worldId: "00000000-0000-0000-0000-000000000002",
        name: "Name only",
      });

      expect(mockWorldUpdateSetting).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000002",
        expect.objectContaining({ content: "" }),
      );
    });

    it("returns error when update fails", async () => {
      mockWorldUpdateSetting.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Not found" },
      });

      const result = await handlers.get("world_update")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        worldId: "00000000-0000-0000-0000-000000000002",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });
  });

  describe("world_delete", () => {
    it("deletes setting and returns id", async () => {
      mockWorldRemoveSetting.mockResolvedValue({ ok: true, data: null });

      const result = await handlers.get("world_delete")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        worldId: "00000000-0000-0000-0000-000000000002",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect((payload.data as Record<string, unknown>).id).toBe("00000000-0000-0000-0000-000000000002");
    });

    it("returns error when delete fails", async () => {
      mockWorldRemoveSetting.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Not found" },
      });

      const result = await handlers.get("world_delete")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        worldId: "00000000-0000-0000-0000-000000000002",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });
  });

  describe("world_check", () => {
    it("returns NOT_IMPLEMENTED", async () => {
      const result = await handlers.get("world_check")!({
        projectId: "00000000-0000-0000-0000-000000000001",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_IMPLEMENTED");
    });
  });

  describe("world_patch", () => {
    it("applies patches and returns applied count", async () => {
      const setting = { id: "w-1", content: "old content" };
      mockWorldReadSetting.mockResolvedValue({ ok: true, data: setting });
      mockApplyPatches.mockReturnValue({ content: "new content", applied: 1, failed: [] });
      mockWorldUpdateSetting.mockResolvedValue({ ok: true, data: {} });

      const result = await handlers.get("world_patch")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        worldId: "00000000-0000-0000-0000-000000000002",
        patches: [{ find: "old", replace: "new" }],
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect((payload.data as Record<string, unknown>).appliedCount).toBe(1);
    });

    it("returns NOT_FOUND when read fails", async () => {
      mockWorldReadSetting.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Not found" },
      });

      const result = await handlers.get("world_patch")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        worldId: "00000000-0000-0000-0000-000000000002",
        patches: [{ find: "x", replace: "y" }],
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });

    it("returns PATCH_NO_MATCH when no patches applied", async () => {
      mockWorldReadSetting.mockResolvedValue({ ok: true, data: { id: "w-1", content: "text" } });
      mockApplyPatches.mockReturnValue({ content: "text", applied: 0, failed: ["xyz"] });

      const result = await handlers.get("world_patch")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        worldId: "00000000-0000-0000-0000-000000000002",
        patches: [{ find: "xyz", replace: "abc" }],
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("PATCH_NO_MATCH");
    });
  });
});
