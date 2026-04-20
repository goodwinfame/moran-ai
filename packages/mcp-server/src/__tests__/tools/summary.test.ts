import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockServer, parseResponse } from "../helpers.js";

const { mockCreateChapterSummary, mockCreateArcSummary, mockReadChapterSummary, mockReadArcSummary, mockListChapterSummaries, mockListArcSummaries } = vi.hoisted(() => ({
  mockCreateChapterSummary: vi.fn(),
  mockCreateArcSummary: vi.fn(),
  mockReadChapterSummary: vi.fn(),
  mockReadArcSummary: vi.fn(),
  mockListChapterSummaries: vi.fn(),
  mockListArcSummaries: vi.fn(),
}));

vi.mock("@moran/core/services", () => ({
  summaryService: {
    createChapterSummary: mockCreateChapterSummary,
    createArcSummary: mockCreateArcSummary,
    readChapterSummary: mockReadChapterSummary,
    readArcSummary: mockReadArcSummary,
    listChapterSummaries: mockListChapterSummaries,
    listArcSummaries: mockListArcSummaries,
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

import { registerSummaryTools } from "../../tools/summary.js";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";

describe("summary tools", () => {
  const { server, handlers } = createMockServer();
  registerSummaryTools(server);

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPrerequisites.mockResolvedValue({ passed: true, conditions: [] });
  });

  describe("summary_create", () => {
    it("creates chapter summary with chapterNumber", async () => {
      mockCreateChapterSummary.mockResolvedValue({
        ok: true,
        data: { id: "sum-1", chapterNumber: 3 },
      });

      const result = await handlers.get("summary_create")!({
        projectId: PROJECT_ID,
        type: "chapter",
        chapterNumber: 3,
        content: "第三章摘要内容",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockCreateChapterSummary).toHaveBeenCalledWith(PROJECT_ID, {
        chapterNumber: 3,
        content: "第三章摘要内容",
      });
    });

    it("returns INVALID_INPUT when type=chapter but chapterNumber missing", async () => {
      const result = await handlers.get("summary_create")!({
        projectId: PROJECT_ID,
        type: "chapter",
        content: "摘要",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("INVALID_INPUT");
      expect(mockCreateChapterSummary).not.toHaveBeenCalled();
    });

    it("creates arc summary with arcIndex", async () => {
      mockCreateArcSummary.mockResolvedValue({
        ok: true,
        data: { id: "sum-2", arcIndex: 0 },
      });

      const result = await handlers.get("summary_create")!({
        projectId: PROJECT_ID,
        type: "arc",
        arcIndex: 0,
        content: "第一弧摘要",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockCreateArcSummary).toHaveBeenCalledWith(PROJECT_ID, {
        arcIndex: 0,
        content: "第一弧摘要",
      });
    });

    it("returns INVALID_INPUT when type=arc but arcIndex missing", async () => {
      const result = await handlers.get("summary_create")!({
        projectId: PROJECT_ID,
        type: "arc",
        content: "摘要",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("INVALID_INPUT");
      expect(mockCreateArcSummary).not.toHaveBeenCalled();
    });

    it("propagates service error", async () => {
      mockCreateChapterSummary.mockResolvedValue({
        ok: false,
        error: { code: "CONFLICT", message: "摘要已存在" },
      });

      const result = await handlers.get("summary_create")!({
        projectId: PROJECT_ID,
        type: "chapter",
        chapterNumber: 1,
        content: "摘要",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("CONFLICT");
    });

    it("blocks chapter summary when review gate not met", async () => {
      mockCheckPrerequisites.mockResolvedValue({
        passed: false,
        conditions: [{ description: "第3章审校已通过（四轮完成）", level: "HARD", met: false }],
      });
      mockToGateDetails.mockReturnValue({
        passed: [],
        failed: ["第3章审校已通过（四轮完成）"],
        suggestions: ["请先完成四轮审校后再创建摘要"],
      });

      const result = await handlers.get("summary_create")!({
        projectId: PROJECT_ID,
        type: "chapter",
        chapterNumber: 3,
        content: "摘要",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("GATE_FAILED");
      expect(mockCreateChapterSummary).not.toHaveBeenCalled();
    });

    it("blocks arc summary when arc chapters not all archived", async () => {
      mockCheckPrerequisites.mockResolvedValue({
        passed: false,
        conditions: [{ description: "弧段0内所有章节已归档", level: "HARD", met: false }],
      });
      mockToGateDetails.mockReturnValue({
        passed: [],
        failed: ["弧段0内所有章节已归档"],
        suggestions: ["弧段内尚有未归档章节"],
      });

      const result = await handlers.get("summary_create")!({
        projectId: PROJECT_ID,
        type: "arc",
        arcIndex: 0,
        content: "弧段摘要",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("GATE_FAILED");
      expect(mockCreateArcSummary).not.toHaveBeenCalled();
    });
  });

  describe("summary_read", () => {
    it("reads chapter summary by chapterNumber", async () => {
      mockReadChapterSummary.mockResolvedValue({
        ok: true,
        data: { id: "sum-1", chapterNumber: 5, content: "第五章摘要" },
      });

      const result = await handlers.get("summary_read")!({
        projectId: PROJECT_ID,
        chapterNumber: 5,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockReadChapterSummary).toHaveBeenCalledWith(PROJECT_ID, 5);
    });

    it("reads arc summary by arcIndex", async () => {
      mockReadArcSummary.mockResolvedValue({
        ok: true,
        data: { id: "sum-2", arcIndex: 1, content: "第二弧摘要" },
      });

      const result = await handlers.get("summary_read")!({
        projectId: PROJECT_ID,
        arcIndex: 1,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockReadArcSummary).toHaveBeenCalledWith(PROJECT_ID, 1);
    });

    it("lists chapter summaries when type=chapter", async () => {
      mockListChapterSummaries.mockResolvedValue({
        ok: true,
        data: [
          { id: "s1", chapterNumber: 1 },
          { id: "s2", chapterNumber: 2 },
        ],
      });

      const result = await handlers.get("summary_read")!({
        projectId: PROJECT_ID,
        type: "chapter",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as unknown[];
      expect(data).toHaveLength(2);
    });

    it("filters chapter summaries by range", async () => {
      mockListChapterSummaries.mockResolvedValue({
        ok: true,
        data: [
          { id: "s1", chapterNumber: 1 },
          { id: "s2", chapterNumber: 5 },
          { id: "s3", chapterNumber: 10 },
        ],
      });

      const result = await handlers.get("summary_read")!({
        projectId: PROJECT_ID,
        type: "chapter",
        range: { from: 3, to: 8 },
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as Array<{ chapterNumber: number }>;
      expect(data).toHaveLength(1);
      expect(data[0]?.chapterNumber).toBe(5);
    });

    it("returns both chapters and arcs when no type filter", async () => {
      mockListChapterSummaries.mockResolvedValue({
        ok: true,
        data: [{ id: "s1", chapterNumber: 1 }],
      });
      mockListArcSummaries.mockResolvedValue({
        ok: true,
        data: [{ id: "a1", arcIndex: 0 }],
      });

      const result = await handlers.get("summary_read")!({
        projectId: PROJECT_ID,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as { chapters: unknown[]; arcs: unknown[] };
      expect(data.chapters).toHaveLength(1);
      expect(data.arcs).toHaveLength(1);
    });

    it("lists arc summaries when type=arc", async () => {
      mockListArcSummaries.mockResolvedValue({
        ok: true,
        data: [{ id: "a1", arcIndex: 0 }, { id: "a2", arcIndex: 1 }],
      });

      const result = await handlers.get("summary_read")!({
        projectId: PROJECT_ID,
        type: "arc",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as unknown[];
      expect(data).toHaveLength(2);
    });

    it("propagates error from readChapterSummary", async () => {
      mockReadChapterSummary.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "摘要不存在" },
      });

      const result = await handlers.get("summary_read")!({
        projectId: PROJECT_ID,
        chapterNumber: 99,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });
  });
});
