/**
 * Unit tests for context tools.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockServer, parseResponse } from "../helpers.js";

const { mockContextAssemble } = vi.hoisted(() => ({
  mockContextAssemble: vi.fn(),
}));
vi.mock("@moran/core/services", () => ({
  contextService: {
    assemble: mockContextAssemble,
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

import { registerContextTools } from "../../tools/context.js";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";

const CONTEXT_PAYLOAD = {
  brief: "chapter brief",
  worldContext: "world",
  characterStates: "chars",
  previousSummary: null,
  styleConfig: "style",
  lessons: [],
  threads: [],
  arcContext: "",
  tokenBudget: {},
};

describe("context tools", () => {
  const { server, handlers } = createMockServer();
  registerContextTools(server);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // context_assemble
  // ---------------------------------------------------------------------------
  describe("context_assemble", () => {
    it("assembles context when gate passes and service succeeds", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true });
      mockContextAssemble.mockResolvedValue({ ok: true, data: CONTEXT_PAYLOAD });

      const result = await handlers.get("context_assemble")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(CONTEXT_PAYLOAD);
    });

    it("returns GATE_FAILED when prerequisites not met", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: false });
      mockToGateDetails.mockReturnValue({ passed: [], failed: ["outline"], suggestions: [] });

      const result = await handlers.get("context_assemble")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("GATE_FAILED");
    });

    it("returns error when service returns NOT_FOUND (no outline or brief)", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true });
      mockContextAssemble.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "大纲不存在" },
      });

      const result = await handlers.get("context_assemble")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });

    it("uses default mode 'write' when mode is not specified", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true });
      mockContextAssemble.mockResolvedValue({ ok: true, data: CONTEXT_PAYLOAD });

      await handlers.get("context_assemble")!({
        projectId: PROJECT_ID,
        chapterNumber: 5,
      });

      expect(mockContextAssemble).toHaveBeenCalledWith(PROJECT_ID, 5, "write");
    });

    it("passes specified mode to service", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true });
      mockContextAssemble.mockResolvedValue({ ok: true, data: CONTEXT_PAYLOAD });

      await handlers.get("context_assemble")!({
        projectId: PROJECT_ID,
        chapterNumber: 3,
        mode: "revise",
      });

      expect(mockContextAssemble).toHaveBeenCalledWith(PROJECT_ID, 3, "revise");
    });
  });
});
