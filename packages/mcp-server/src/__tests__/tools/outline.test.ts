import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockServer, parseResponse } from "../helpers.js";

const { mockCreateOutline, mockReadOutline, mockUpdateOutline, mockCreateArc, mockReadArc, mockUpdateArc, mockListArcs, mockReadBrief, mockCreateBrief, mockUpdateBrief } = vi.hoisted(() => ({
  mockCreateOutline: vi.fn(),
  mockReadOutline: vi.fn(),
  mockUpdateOutline: vi.fn(),
  mockCreateArc: vi.fn(),
  mockReadArc: vi.fn(),
  mockUpdateArc: vi.fn(),
  mockListArcs: vi.fn(),
  mockReadBrief: vi.fn(),
  mockCreateBrief: vi.fn(),
  mockUpdateBrief: vi.fn(),
}));

vi.mock("@moran/core/services", () => ({
  outlineService: {
    createOutline: mockCreateOutline,
    readOutline: mockReadOutline,
    updateOutline: mockUpdateOutline,
    createArc: mockCreateArc,
    readArc: mockReadArc,
    updateArc: mockUpdateArc,
    listArcs: mockListArcs,
  },
  chapterService: {
    readBrief: mockReadBrief,
    createBrief: mockCreateBrief,
    updateBrief: mockUpdateBrief,
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
  applyPatches: vi.fn((original: string, patches: Array<{ find: string; replace: string }>) => {
    let content = original;
    let applied = 0;
    const failed: string[] = [];
    for (const p of patches) {
      if (content.includes(p.find)) {
        content = content.replace(p.find, p.replace);
        applied++;
      } else {
        failed.push(p.find);
      }
    }
    return { content, applied, failed };
  }),
}));

import { registerOutlineTools } from "../../tools/outline.js";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const OUTLINE_ID = "00000000-0000-0000-0000-000000000010";
const ARC_ID = "00000000-0000-0000-0000-000000000020";
const CHAR_ID = "00000000-0000-0000-0000-000000000030";

const SAMPLE_ARC = {
  title: "第一弧",
  startChapter: 1,
  endChapter: 10,
  coreConflict: "主角觉醒",
  climax: "最终决战",
  keyCharacterIds: [CHAR_ID],
};

describe("outline tools", () => {
  const { server, handlers } = createMockServer();
  registerOutlineTools(server);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("outline_create", () => {
    it("creates outline and arcs in sequence", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true, conditions: [] });
      mockCreateOutline.mockResolvedValue({ ok: true, data: { id: OUTLINE_ID } });
      mockCreateArc.mockResolvedValue({ ok: true, data: { id: ARC_ID } });

      const result = await handlers.get("outline_create")!({
        projectId: PROJECT_ID,
        synopsis: "一个关于觉醒的故事",
        arcs: [SAMPLE_ARC],
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockCreateOutline).toHaveBeenCalledWith(PROJECT_ID, { synopsis: "一个关于觉醒的故事" });
      expect(mockCreateArc).toHaveBeenCalledTimes(1);
      expect(mockCreateArc).toHaveBeenCalledWith(
        PROJECT_ID,
        expect.objectContaining({
          arcIndex: 0,
          title: "第一弧",
          description: "主角觉醒",
        }),
      );
      const data = payload.data as { id: string; arcIds: string[] };
      expect(data.id).toBe(OUTLINE_ID);
      expect(data.arcIds).toEqual([ARC_ID]);
    });

    it("returns GATE_FAILED when prerequisites not met", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: false, conditions: [] });
      mockToGateDetails.mockReturnValue({ passed: [], failed: ["outline_design"], suggestions: [] });

      const result = await handlers.get("outline_create")!({
        projectId: PROJECT_ID,
        synopsis: "test",
        arcs: [],
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("GATE_FAILED");
    });

    it("returns early if outline creation fails", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true, conditions: [] });
      mockCreateOutline.mockResolvedValue({
        ok: false,
        error: { code: "CONFLICT", message: "大纲已存在" },
      });

      const result = await handlers.get("outline_create")!({
        projectId: PROJECT_ID,
        synopsis: "test",
        arcs: [SAMPLE_ARC],
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(mockCreateArc).not.toHaveBeenCalled();
    });

    it("skips failed arcs but continues", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true, conditions: [] });
      mockCreateOutline.mockResolvedValue({ ok: true, data: { id: OUTLINE_ID } });
      mockCreateArc
        .mockResolvedValueOnce({ ok: false, error: { code: "INTERNAL", message: "失败" } })
        .mockResolvedValueOnce({ ok: true, data: { id: ARC_ID } });

      const result = await handlers.get("outline_create")!({
        projectId: PROJECT_ID,
        synopsis: "test",
        arcs: [SAMPLE_ARC, { ...SAMPLE_ARC, title: "第二弧" }],
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as { arcIds: string[] };
      expect(data.arcIds).toHaveLength(1);
    });
  });

  describe("outline_read", () => {
    it("reads full outline with arcs when no filters", async () => {
      mockReadOutline.mockResolvedValue({
        ok: true,
        data: { id: OUTLINE_ID, synopsis: "故事梗概" },
      });
      mockListArcs.mockResolvedValue({
        ok: true,
        data: [{ id: ARC_ID, title: "第一弧", detailedPlan: null }],
      });

      const result = await handlers.get("outline_read")!({ projectId: PROJECT_ID });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as { arcs: unknown[] };
      expect(data.arcs).toHaveLength(1);
    });

    it("reads specific arc by arcIndex", async () => {
      mockReadArc.mockResolvedValue({
        ok: true,
        data: {
          id: ARC_ID,
          title: "第一弧",
          detailedPlan: JSON.stringify({ climax: "决战", coreConflict: "觉醒" }),
        },
      });

      const result = await handlers.get("outline_read")!({
        projectId: PROJECT_ID,
        arcIndex: 0,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as Record<string, unknown>;
      expect(data.climax).toBe("决战");
    });

    it("reads specific chapter brief by chapterNumber", async () => {
      mockReadBrief.mockResolvedValue({
        ok: true,
        data: { id: "brief-1", chapterNumber: 3, hardConstraints: { title: "第三章" } },
      });

      const result = await handlers.get("outline_read")!({
        projectId: PROJECT_ID,
        chapterNumber: 3,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockReadBrief).toHaveBeenCalledWith(PROJECT_ID, 3);
    });

    it("returns error when outline not found", async () => {
      mockReadOutline.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "大纲不存在" },
      });

      const result = await handlers.get("outline_read")!({ projectId: PROJECT_ID });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
    });
  });

  describe("outline_update", () => {
    it("updates synopsis", async () => {
      mockReadOutline.mockResolvedValue({ ok: true, data: { id: OUTLINE_ID, synopsis: "旧梗概" } });
      mockUpdateOutline.mockResolvedValue({ ok: true, data: { id: OUTLINE_ID } });

      const result = await handlers.get("outline_update")!({
        projectId: PROJECT_ID,
        synopsis: "新梗概",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as { updated: string[] };
      expect(data.updated).toContain("synopsis");
    });

    it("updates arc data", async () => {
      mockReadOutline.mockResolvedValue({ ok: true, data: { id: OUTLINE_ID } });
      mockReadArc.mockResolvedValue({
        ok: true,
        data: { id: ARC_ID, detailedPlan: JSON.stringify({ climax: "旧高潮" }) },
      });
      mockUpdateArc.mockResolvedValue({ ok: true, data: { id: ARC_ID } });

      const result = await handlers.get("outline_update")!({
        projectId: PROJECT_ID,
        arcIndex: 0,
        arcData: { title: "新标题", climax: "新高潮" },
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as { updated: string[] };
      expect(data.updated).toContain("arc[0]");
    });

    it("creates chapter brief when not existing", async () => {
      mockReadOutline.mockResolvedValue({ ok: true, data: { id: OUTLINE_ID } });
      mockReadBrief.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "不存在" },
      });
      mockCreateBrief.mockResolvedValue({ ok: true, data: { id: "brief-1" } });

      const result = await handlers.get("outline_update")!({
        projectId: PROJECT_ID,
        chapterBrief: { chapterNumber: 5, title: "第五章", brief: "内容摘要" },
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockCreateBrief).toHaveBeenCalled();
    });

    it("updates existing chapter brief", async () => {
      mockReadOutline.mockResolvedValue({ ok: true, data: { id: OUTLINE_ID } });
      mockReadBrief.mockResolvedValue({ ok: true, data: { id: "brief-1" } });
      mockUpdateBrief.mockResolvedValue({ ok: true, data: { id: "brief-1" } });

      const result = await handlers.get("outline_update")!({
        projectId: PROJECT_ID,
        chapterBrief: { chapterNumber: 5, title: "第五章", brief: "新内容" },
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockUpdateBrief).toHaveBeenCalled();
    });

    it("returns NOT_FOUND when outline does not exist", async () => {
      mockReadOutline.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "大纲不存在" },
      });

      const result = await handlers.get("outline_update")!({
        projectId: PROJECT_ID,
        synopsis: "test",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });
  });

  describe("outline_patch", () => {
    it("applies patch to synopsis content", async () => {
      mockReadOutline.mockResolvedValue({
        ok: true,
        data: { id: OUTLINE_ID, synopsis: "原始内容，需要替换" },
      });
      mockUpdateOutline.mockResolvedValue({ ok: true, data: { id: OUTLINE_ID } });

      const result = await handlers.get("outline_patch")!({
        projectId: PROJECT_ID,
        outlineId: OUTLINE_ID,
        patches: [{ find: "需要替换", replace: "已替换" }],
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as { appliedCount: number };
      expect(data.appliedCount).toBe(1);
    });

    it("returns PATCH_NO_MATCH when no patches match", async () => {
      mockReadOutline.mockResolvedValue({
        ok: true,
        data: { id: OUTLINE_ID, synopsis: "内容" },
      });

      const result = await handlers.get("outline_patch")!({
        projectId: PROJECT_ID,
        outlineId: OUTLINE_ID,
        patches: [{ find: "不存在的文本", replace: "替换" }],
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("PATCH_NO_MATCH");
    });

    it("returns NOT_FOUND when outline missing", async () => {
      mockReadOutline.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "大纲不存在" },
      });

      const result = await handlers.get("outline_patch")!({
        projectId: PROJECT_ID,
        outlineId: OUTLINE_ID,
        patches: [{ find: "x", replace: "y" }],
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });
  });
});
