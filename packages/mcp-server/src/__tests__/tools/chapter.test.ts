import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockServer, parseResponse } from "../helpers.js";

const { mockCreate, mockRead, mockReadById, mockList, mockUpdate, mockPatch, mockArchive, mockListVersions, mockCreateVersion } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockRead: vi.fn(),
  mockReadById: vi.fn(),
  mockList: vi.fn(),
  mockUpdate: vi.fn(),
  mockPatch: vi.fn(),
  mockArchive: vi.fn(),
  mockListVersions: vi.fn(),
  mockCreateVersion: vi.fn(),
}));

vi.mock("@moran/core/services", () => ({
  chapterService: {
    create: mockCreate,
    read: mockRead,
    readById: mockReadById,
    list: mockList,
    update: mockUpdate,
    patch: mockPatch,
    archive: mockArchive,
    listVersions: mockListVersions,
    createVersion: mockCreateVersion,
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

import { registerChapterTools } from "../../tools/chapter.js";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const CHAPTER_ID = "00000000-0000-0000-0000-000000000011";

describe("chapter tools", () => {
  const { server, handlers } = createMockServer();
  registerChapterTools(server);

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPrerequisites.mockResolvedValue({ passed: true, conditions: [] });
  });

  describe("chapter_create", () => {
    it("creates chapter with auto word count", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true, conditions: [] });
      mockRead.mockResolvedValue({ ok: false, error: { code: "NOT_FOUND", message: "不存在" } });
      mockCreate.mockResolvedValue({ ok: true, data: { id: CHAPTER_ID } });

      const result = await handlers.get("chapter_create")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
        title: "第一章",
        content: "这是章节内容，共有一些文字。",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(
        PROJECT_ID,
        expect.objectContaining({
          chapterNumber: 1,
          title: "第一章",
        }),
      );
      const data = payload.data as { id: string; version: number };
      expect(data.version).toBe(1);
    });

    it("uses provided wordCount instead of auto-calculating", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true, conditions: [] });
      mockRead.mockResolvedValue({ ok: false, error: { code: "NOT_FOUND", message: "不存在" } });
      mockCreate.mockResolvedValue({ ok: true, data: { id: CHAPTER_ID } });

      await handlers.get("chapter_create")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
        title: "第一章",
        content: "内容",
        wordCount: 9999,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        PROJECT_ID,
        expect.objectContaining({ wordCount: 9999 }),
      );
    });

    it("maps writerPreset to writerStyle", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true, conditions: [] });
      mockRead.mockResolvedValue({ ok: false, error: { code: "NOT_FOUND", message: "不存在" } });
      mockCreate.mockResolvedValue({ ok: true, data: { id: CHAPTER_ID } });

      await handlers.get("chapter_create")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
        title: "第一章",
        content: "内容",
        writerPreset: "剑心",
      });

      expect(mockCreate).toHaveBeenCalledWith(
        PROJECT_ID,
        expect.objectContaining({ writerStyle: "剑心" }),
      );
    });

    it("rejects archived chapter", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true, conditions: [] });
      mockRead.mockResolvedValue({
        ok: true,
        data: { id: CHAPTER_ID, status: "archived" },
      });

      const result = await handlers.get("chapter_create")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
        title: "第一章",
        content: "内容",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("GATE_FAILED");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns GATE_FAILED when prerequisites not met", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: false, conditions: [] });
      mockToGateDetails.mockReturnValue({ passed: [], failed: ["chapter_write"], suggestions: [] });

      const result = await handlers.get("chapter_create")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
        title: "第一章",
        content: "内容",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("GATE_FAILED");
    });
  });

  describe("chapter_read", () => {
    it("lists chapters without content by default", async () => {
      mockList.mockResolvedValue({
        ok: true,
        data: [
          { id: CHAPTER_ID, chapterNumber: 1, title: "第一章", content: "正文内容" },
        ],
      });

      const result = await handlers.get("chapter_read")!({ projectId: PROJECT_ID });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as Array<Record<string, unknown>>;
      expect(data[0]).not.toHaveProperty("content");
    });

    it("lists chapters with content when includeContent=true", async () => {
      mockList.mockResolvedValue({
        ok: true,
        data: [{ id: CHAPTER_ID, chapterNumber: 1, content: "正文内容" }],
      });

      const result = await handlers.get("chapter_read")!({
        projectId: PROJECT_ID,
        includeContent: true,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as Array<Record<string, unknown>>;
      expect(data[0]).toHaveProperty("content");
    });

    it("reads single chapter by chapterNumber", async () => {
      mockRead.mockResolvedValue({
        ok: true,
        data: { id: CHAPTER_ID, chapterNumber: 1, content: "内容" },
      });

      const result = await handlers.get("chapter_read")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockRead).toHaveBeenCalledWith(PROJECT_ID, 1);
    });

    it("reads specific version", async () => {
      mockRead.mockResolvedValue({
        ok: true,
        data: { id: CHAPTER_ID, chapterNumber: 1, content: "当前内容" },
      });
      mockListVersions.mockResolvedValue({
        ok: true,
        data: [
          { version: 1, content: "版本1内容", wordCount: 100 },
          { version: 2, content: "版本2内容", wordCount: 200 },
        ],
      });

      const result = await handlers.get("chapter_read")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
        version: 1,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as Record<string, unknown>;
      expect(data.content).toBe("版本1内容");
      expect(data.currentVersion).toBe(1);
    });

    it("returns NOT_FOUND for missing version", async () => {
      mockRead.mockResolvedValue({
        ok: true,
        data: { id: CHAPTER_ID, chapterNumber: 1 },
      });
      mockListVersions.mockResolvedValue({
        ok: true,
        data: [{ version: 1, content: "内容", wordCount: 100 }],
      });

      const result = await handlers.get("chapter_read")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
        version: 99,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });
  });

  describe("chapter_update", () => {
    it("saves version snapshot before updating", async () => {
      mockRead.mockResolvedValue({
        ok: true,
        data: {
          id: CHAPTER_ID,
          content: "旧内容",
          wordCount: 50,
          currentVersion: 1,
        },
      });
      mockCreateVersion.mockResolvedValue({ ok: true, data: {} });
      mockUpdate.mockResolvedValue({
        ok: true,
        data: { id: CHAPTER_ID, currentVersion: 2 },
      });

      const result = await handlers.get("chapter_update")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
        feedback: [{ issue: "语法错误", severity: "minor", suggestion: "修改" }],
        revisedContent: "新内容",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockCreateVersion).toHaveBeenCalledWith(
        CHAPTER_ID,
        expect.objectContaining({ version: 1, content: "旧内容" }),
      );
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("returns NOT_FOUND when chapter missing", async () => {
      mockRead.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "章节不存在" },
      });

      const result = await handlers.get("chapter_update")!({
        projectId: PROJECT_ID,
        chapterNumber: 99,
        feedback: [],
        revisedContent: "内容",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });

    it("skips version snapshot when chapter has no content", async () => {
      mockRead.mockResolvedValue({
        ok: true,
        data: { id: CHAPTER_ID, content: null, wordCount: 0, currentVersion: 1 },
      });
      mockUpdate.mockResolvedValue({
        ok: true,
        data: { id: CHAPTER_ID, currentVersion: 1 },
      });

      await handlers.get("chapter_update")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
        feedback: [],
        revisedContent: "新内容",
      });

      expect(mockCreateVersion).not.toHaveBeenCalled();
    });

    it("blocks when review report gate not met", async () => {
      mockCheckPrerequisites.mockResolvedValue({
        passed: false,
        conditions: [{ description: "第1章有对应的审校报告", level: "HARD", met: false }],
      });
      mockToGateDetails.mockReturnValue({
        passed: [],
        failed: ["第1章有对应的审校报告"],
        suggestions: ["该章节没有审校报告，请先执行审校"],
      });

      const result = await handlers.get("chapter_update")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
        feedback: [],
        revisedContent: "内容",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("GATE_FAILED");
      expect(mockRead).not.toHaveBeenCalled();
    });
  });

  describe("chapter_archive", () => {
    it("archives chapter successfully", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true, conditions: [] });
      mockRead.mockResolvedValue({
        ok: true,
        data: { id: CHAPTER_ID, chapterNumber: 1 },
      });
      mockArchive.mockResolvedValue({
        ok: true,
        data: { id: CHAPTER_ID, archivedVersion: 3 },
      });

      const result = await handlers.get("chapter_archive")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as { id: string; version: number };
      expect(data.version).toBe(3);
    });

    it("returns GATE_FAILED when prerequisites not met", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: false, conditions: [] });
      mockToGateDetails.mockReturnValue({ passed: [], failed: ["archive"], suggestions: [] });

      const result = await handlers.get("chapter_archive")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("GATE_FAILED");
    });

    it("returns NOT_FOUND when chapter missing", async () => {
      mockCheckPrerequisites.mockResolvedValue({ passed: true, conditions: [] });
      mockRead.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "章节不存在" },
      });

      const result = await handlers.get("chapter_archive")!({
        projectId: PROJECT_ID,
        chapterNumber: 99,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });
  });

  describe("chapter_patch", () => {
    it("applies patch to chapter content", async () => {
      mockReadById.mockResolvedValue({
        ok: true,
        data: { id: CHAPTER_ID, content: "原始内容，需要替换" },
      });
      mockPatch.mockResolvedValue({ ok: true, data: { id: CHAPTER_ID } });

      const result = await handlers.get("chapter_patch")!({
        projectId: PROJECT_ID,
        chapterId: CHAPTER_ID,
        patches: [{ find: "需要替换", replace: "已替换" }],
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as { appliedCount: number };
      expect(data.appliedCount).toBe(1);
    });

    it("returns PATCH_NO_MATCH when no patches match", async () => {
      mockReadById.mockResolvedValue({
        ok: true,
        data: { id: CHAPTER_ID, content: "内容" },
      });

      const result = await handlers.get("chapter_patch")!({
        projectId: PROJECT_ID,
        chapterId: CHAPTER_ID,
        patches: [{ find: "不存在的文本", replace: "替换" }],
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("PATCH_NO_MATCH");
    });

    it("returns NOT_FOUND when chapter missing", async () => {
      mockReadById.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "章节不存在" },
      });

      const result = await handlers.get("chapter_patch")!({
        projectId: PROJECT_ID,
        chapterId: CHAPTER_ID,
        patches: [{ find: "x", replace: "y" }],
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });
  });
});
