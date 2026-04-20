/**
 * Unit tests for review tools.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockServer, parseResponse } from "../helpers.js";

const { mockSaveRound, mockReadRound, mockReadByChapter } = vi.hoisted(() => ({
  mockSaveRound: vi.fn(),
  mockReadRound: vi.fn(),
  mockReadByChapter: vi.fn(),
}));
vi.mock("@moran/core/services", () => ({
  reviewService: {
    saveRound: mockSaveRound,
    readRound: mockReadRound,
    readByChapter: mockReadByChapter,
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

import { registerReviewTools } from "../../tools/review.js";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";

const VALID_RESULT = JSON.stringify({
  passed: true,
  score: 90,
  issues: [],
});

describe("review tools", () => {
  const { server, handlers } = createMockServer();
  registerReviewTools(server);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // review_execute
  // ---------------------------------------------------------------------------
  describe("review_execute", () => {
    it("saves review round when gate passes and service succeeds", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true });
      mockSaveRound.mockResolvedValue({ ok: true, data: { id: "r-1" } });

      const result = await handlers.get("review_execute")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
        round: 1,
        result: VALID_RESULT,
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect((payload.data as Record<string, unknown>).id).toBe("r-1");
    });

    it("returns GATE_FAILED when prerequisites not met", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: false });
      mockToGateDetails.mockReturnValue({ passed: [], failed: ["chapter"], suggestions: [] });

      const result = await handlers.get("review_execute")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
        round: 1,
        result: VALID_RESULT,
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("GATE_FAILED");
    });

    it("returns error when service fails", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true });
      mockSaveRound.mockResolvedValue({
        ok: false,
        error: { code: "INSERT_FAILED", message: "审校轮次保存失败" },
      });

      const result = await handlers.get("review_execute")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
        round: 2,
        result: VALID_RESULT,
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("INSERT_FAILED");
    });

    it("returns VALIDATION_ERROR for invalid JSON in result", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true });

      const result = await handlers.get("review_execute")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
        round: 1,
        result: "not valid json{{{",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("VALIDATION_ERROR");
    });

    it("calls saveRound with correct params for each round", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true });
      mockSaveRound.mockResolvedValue({ ok: true, data: { id: "r-1" } });

      for (const round of [1, 2, 3, 4] as const) {
        await handlers.get("review_execute")!({
          projectId: PROJECT_ID,
          chapterNumber: 3,
          round,
          result: VALID_RESULT,
        });
        expect(mockSaveRound).toHaveBeenCalledWith(
          PROJECT_ID,
          3,
          round,
          expect.objectContaining({ passed: true }),
        );
      }
    });
  });

  // ---------------------------------------------------------------------------
  // review_read
  // ---------------------------------------------------------------------------
  describe("review_read", () => {
    it("calls readRound when round is provided", async () => {
      const doc = { id: "r-1", content: "{}" };
      mockReadRound.mockResolvedValue({ ok: true, data: doc });

      const result = await handlers.get("review_read")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
        round: 2,
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(mockReadRound).toHaveBeenCalledWith(PROJECT_ID, 1, 2);
      expect(mockReadByChapter).not.toHaveBeenCalled();
    });

    it("calls readByChapter when round is not provided", async () => {
      const docs = [{ id: "r-1" }, { id: "r-2" }];
      mockReadByChapter.mockResolvedValue({ ok: true, data: docs });

      const result = await handlers.get("review_read")!({
        projectId: PROJECT_ID,
        chapterNumber: 3,
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(mockReadByChapter).toHaveBeenCalledWith(PROJECT_ID, 3);
      expect(mockReadRound).not.toHaveBeenCalled();
    });

    it("returns error when round not found", async () => {
      mockReadRound.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "审校记录不存在" },
      });

      const result = await handlers.get("review_read")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
        round: 3,
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });
  });
});
