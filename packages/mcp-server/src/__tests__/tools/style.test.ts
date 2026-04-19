import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockServer, parseResponse } from "../helpers.js";

const { mockCreate, mockRead, mockList, mockUpdate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockRead: vi.fn(),
  mockList: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@moran/core/services", () => ({
  styleService: {
    create: mockCreate,
    read: mockRead,
    list: mockList,
    update: mockUpdate,
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

import { registerStyleTools } from "../../tools/style.js";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const STYLE_ID = "00000000-0000-0000-0000-000000000002";

describe("style tools", () => {
  const { server, handlers } = createMockServer();
  registerStyleTools(server);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("style_create", () => {
    it("succeeds with preset and valid config", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true, conditions: [] });
      mockCreate.mockResolvedValue({ ok: true, data: { id: STYLE_ID } });

      const config = JSON.stringify({ prose: "冷峻简约", examples: ["示例1", "示例2"] });
      const result = await handlers.get("style_create")!({
        projectId: PROJECT_ID,
        preset: "剑心",
        config,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: PROJECT_ID,
          styleId: "剑心",
          displayName: "执笔·剑心",
          proseGuide: "冷峻简约",
        }),
      );
    });

    it("uses custom displayName when no preset", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true, conditions: [] });
      mockCreate.mockResolvedValue({ ok: true, data: { id: STYLE_ID } });

      const config = JSON.stringify({ prose: "自定义风格" });
      await handlers.get("style_create")!({
        projectId: PROJECT_ID,
        config,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          styleId: "custom",
          displayName: "自定义文风",
        }),
      );
    });

    it("joins examples with separator", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true, conditions: [] });
      mockCreate.mockResolvedValue({ ok: true, data: { id: STYLE_ID } });

      const config = JSON.stringify({ examples: ["A", "B", "C"] });
      await handlers.get("style_create")!({
        projectId: PROJECT_ID,
        config,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          examples: "A\n---\nB\n---\nC",
        }),
      );
    });

    it("returns GATE_FAILED when prerequisites not met", async () => {
      mockCheckPrerequisites.mockResolvedValue({
        passed: false,
        conditions: [{ name: "style_design", passed: false }],
      });
      mockToGateDetails.mockReturnValue({
        passed: [],
        failed: ["style_design"],
        suggestions: ["先完成设定"],
      });

      const result = await handlers.get("style_create")!({
        projectId: PROJECT_ID,
        config: JSON.stringify({ prose: "test" }),
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("GATE_FAILED");
    });

    it("returns INVALID_INPUT for invalid JSON config", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true, conditions: [] });

      const result = await handlers.get("style_create")!({
        projectId: PROJECT_ID,
        config: "not-valid-json",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("INVALID_INPUT");
    });

    it("propagates service error", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true, conditions: [] });
      mockCreate.mockResolvedValue({
        ok: false,
        error: { code: "CONFLICT", message: "已存在" },
      });

      const result = await handlers.get("style_create")!({
        projectId: PROJECT_ID,
        config: JSON.stringify({ prose: "test" }),
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("CONFLICT");
    });
  });

  describe("style_read", () => {
    it("reads single style when styleId provided", async () => {
      mockRead.mockResolvedValue({ ok: true, data: { id: STYLE_ID, displayName: "执笔·剑心" } });

      const result = await handlers.get("style_read")!({
        projectId: PROJECT_ID,
        styleId: STYLE_ID,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockRead).toHaveBeenCalledWith(STYLE_ID);
      expect(mockList).not.toHaveBeenCalled();
    });

    it("lists styles when no styleId", async () => {
      mockList.mockResolvedValue({ ok: true, data: [{ id: STYLE_ID }] });

      const result = await handlers.get("style_read")!({
        projectId: PROJECT_ID,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockList).toHaveBeenCalledWith(PROJECT_ID);
      expect(mockRead).not.toHaveBeenCalled();
    });

    it("propagates read error", async () => {
      mockRead.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "不存在" },
      });

      const result = await handlers.get("style_read")!({
        projectId: PROJECT_ID,
        styleId: STYLE_ID,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });
  });

  describe("style_update", () => {
    it("updates preset and config", async () => {
      mockUpdate.mockResolvedValue({ ok: true, data: { id: STYLE_ID } });

      const config = JSON.stringify({ prose: "新风格", examples: ["ex1"] });
      const result = await handlers.get("style_update")!({
        projectId: PROJECT_ID,
        styleId: STYLE_ID,
        preset: "星河",
        config,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        STYLE_ID,
        expect.objectContaining({
          styleId: "星河",
          displayName: "执笔·星河",
          proseGuide: "新风格",
        }),
      );
    });

    it("updates only preset without config", async () => {
      mockUpdate.mockResolvedValue({ ok: true, data: { id: STYLE_ID } });

      await handlers.get("style_update")!({
        projectId: PROJECT_ID,
        styleId: STYLE_ID,
        preset: "素手",
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        STYLE_ID,
        expect.objectContaining({ styleId: "素手", displayName: "执笔·素手" }),
      );
    });

    it("stores invalid JSON config as-is in description", async () => {
      mockUpdate.mockResolvedValue({ ok: true, data: { id: STYLE_ID } });

      await handlers.get("style_update")!({
        projectId: PROJECT_ID,
        styleId: STYLE_ID,
        config: "raw-text-not-json",
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        STYLE_ID,
        expect.objectContaining({ description: "raw-text-not-json" }),
      );
    });

    it("propagates service error", async () => {
      mockUpdate.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "文风不存在" },
      });

      const result = await handlers.get("style_update")!({
        projectId: PROJECT_ID,
        styleId: STYLE_ID,
        preset: "云墨",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });
  });
});
