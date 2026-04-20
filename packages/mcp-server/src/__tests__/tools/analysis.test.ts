/**
 * Unit tests for analysis tools.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockServer, parseResponse } from "../helpers.js";

const { mockAnalysisSave, mockAnalysisList } = vi.hoisted(() => ({
  mockAnalysisSave: vi.fn(),
  mockAnalysisList: vi.fn(),
}));
vi.mock("@moran/core/services", () => ({
  analysisService: {
    save: mockAnalysisSave,
    list: mockAnalysisList,
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

import { registerAnalysisTools } from "../../tools/analysis.js";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";

const VALID_DATA = JSON.stringify({
  scope: "chapter",
  dimensions: {},
  overall: 80,
  topIssues: [],
});

describe("analysis tools", () => {
  const { server, handlers } = createMockServer();
  registerAnalysisTools(server);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // analysis_execute
  // ---------------------------------------------------------------------------
  describe("analysis_execute", () => {
    it("saves analysis when gate passes and service succeeds", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true });
      mockAnalysisSave.mockResolvedValue({ ok: true, data: { id: "a-1" } });

      const result = await handlers.get("analysis_execute")!({
        projectId: PROJECT_ID,
        scope: "chapter",
        data: VALID_DATA,
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect((payload.data as Record<string, unknown>).id).toBe("a-1");
    });

    it("returns GATE_FAILED when prerequisites not met", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: false });
      mockToGateDetails.mockReturnValue({ passed: [], failed: ["content"], suggestions: [] });

      const result = await handlers.get("analysis_execute")!({
        projectId: PROJECT_ID,
        scope: "arc",
        data: VALID_DATA,
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("GATE_FAILED");
    });

    it("returns error when service fails", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true });
      mockAnalysisSave.mockResolvedValue({
        ok: false,
        error: { code: "INSERT_FAILED", message: "分析报告保存失败" },
      });

      const result = await handlers.get("analysis_execute")!({
        projectId: PROJECT_ID,
        scope: "full",
        data: VALID_DATA,
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("INSERT_FAILED");
    });

    it("returns VALIDATION_ERROR for invalid JSON in data", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true });

      const result = await handlers.get("analysis_execute")!({
        projectId: PROJECT_ID,
        scope: "chapter",
        data: "{ invalid json",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("VALIDATION_ERROR");
    });
  });

  // ---------------------------------------------------------------------------
  // analysis_read
  // ---------------------------------------------------------------------------
  describe("analysis_read", () => {
    it("lists all analyses without filters", async () => {
      const docs = [{ id: "a-1" }, { id: "a-2" }];
      mockAnalysisList.mockResolvedValue({ ok: true, data: docs });

      const result = await handlers.get("analysis_read")!({
        projectId: PROJECT_ID,
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(mockAnalysisList).toHaveBeenCalledWith(PROJECT_ID, {
        scope: undefined,
        latest: undefined,
      });
    });

    it("passes scope filter to list", async () => {
      mockAnalysisList.mockResolvedValue({ ok: true, data: [] });

      await handlers.get("analysis_read")!({
        projectId: PROJECT_ID,
        scope: "full",
      });

      expect(mockAnalysisList).toHaveBeenCalledWith(PROJECT_ID, {
        scope: "full",
        latest: undefined,
      });
    });

    it("passes latest=true to list", async () => {
      mockAnalysisList.mockResolvedValue({ ok: true, data: [] });

      await handlers.get("analysis_read")!({
        projectId: PROJECT_ID,
        latest: true,
      });

      expect(mockAnalysisList).toHaveBeenCalledWith(PROJECT_ID, {
        scope: undefined,
        latest: true,
      });
    });

    it("returns error when service fails", async () => {
      mockAnalysisList.mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "数据库错误" },
      });

      const result = await handlers.get("analysis_read")!({
        projectId: PROJECT_ID,
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("DB_ERROR");
    });
  });
});
