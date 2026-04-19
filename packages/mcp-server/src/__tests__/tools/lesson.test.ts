/**
 * Unit tests for lesson tools.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockServer, parseResponse } from "../helpers.js";

const { mockCreate, mockRead, mockList, mockUpdate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockRead: vi.fn(),
  mockList: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@moran/core/services", () => ({
  lessonService: {
    create: mockCreate,
    read: mockRead,
    list: mockList,
    update: mockUpdate,
  },
}));

import { registerLessonTools } from "../../tools/lesson.js";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const LESSON_ID = "00000000-0000-0000-0000-000000000003";

const DESC_SEPARATOR = "\n\n---\n\n修正方式：";

describe("lesson tools", () => {
  const { server, handlers } = createMockServer();
  registerLessonTools(server);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // lesson_create
  // ---------------------------------------------------------------------------
  describe("lesson_create", () => {
    it("maps source→title, pattern+correction→description, category→issueType", async () => {
      mockCreate.mockResolvedValue({ ok: true, data: { id: LESSON_ID } });

      const result = await handlers.get("lesson_create")!({
        projectId: PROJECT_ID,
        source: "第12章用户修改",
        pattern: "过度使用副词",
        correction: "改用动词表达",
        category: "style",
        severity: "medium",
      });

      expect(mockCreate).toHaveBeenCalledWith(PROJECT_ID, {
        title: "第12章用户修改",
        description: `过度使用副词${DESC_SEPARATOR}改用动词表达`,
        issueType: "style",
        severity: "major",
        status: "active",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
    });

    it("maps severity high→critical", async () => {
      mockCreate.mockResolvedValue({ ok: true, data: { id: LESSON_ID } });

      await handlers.get("lesson_create")!({
        projectId: PROJECT_ID,
        source: "审校反馈",
        pattern: "角色前后矛盾",
        correction: "保持一致性",
        category: "consistency",
        severity: "high",
      });

      expect(mockCreate).toHaveBeenCalledWith(
        PROJECT_ID,
        expect.objectContaining({ severity: "critical" }),
      );
    });

    it("maps severity low→minor", async () => {
      mockCreate.mockResolvedValue({ ok: true, data: { id: LESSON_ID } });

      await handlers.get("lesson_create")!({
        projectId: PROJECT_ID,
        source: "审校反馈",
        pattern: "标点问题",
        correction: "修正标点",
        category: "style",
        severity: "low",
      });

      expect(mockCreate).toHaveBeenCalledWith(
        PROJECT_ID,
        expect.objectContaining({ severity: "minor" }),
      );
    });

    it("defaults severity to major when not provided", async () => {
      mockCreate.mockResolvedValue({ ok: true, data: { id: LESSON_ID } });

      await handlers.get("lesson_create")!({
        projectId: PROJECT_ID,
        source: "审校反馈",
        pattern: "问题",
        correction: "修正",
        category: "anti_ai",
      });

      expect(mockCreate).toHaveBeenCalledWith(
        PROJECT_ID,
        expect.objectContaining({ severity: "major" }),
      );
    });

    it("always sets status to active on create", async () => {
      mockCreate.mockResolvedValue({ ok: true, data: { id: LESSON_ID } });

      await handlers.get("lesson_create")!({
        projectId: PROJECT_ID,
        source: "s",
        pattern: "p",
        correction: "c",
        category: "pacing",
      });

      expect(mockCreate).toHaveBeenCalledWith(
        PROJECT_ID,
        expect.objectContaining({ status: "active" }),
      );
    });

    it("returns error when service fails", async () => {
      mockCreate.mockResolvedValue({
        ok: false,
        error: { code: "INTERNAL", message: "DB error" },
      });

      const result = await handlers.get("lesson_create")!({
        projectId: PROJECT_ID,
        source: "s",
        pattern: "p",
        correction: "c",
        category: "character",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // lesson_read
  // ---------------------------------------------------------------------------
  describe("lesson_read", () => {
    it("reads single lesson by lessonId", async () => {
      const lesson = { id: LESSON_ID, title: "T", description: "D", issueType: "style" };
      mockRead.mockResolvedValue({ ok: true, data: lesson });

      const result = await handlers.get("lesson_read")!({
        projectId: PROJECT_ID,
        lessonId: LESSON_ID,
      });

      expect(mockRead).toHaveBeenCalledWith(PROJECT_ID, LESSON_ID);
      expect(mockList).not.toHaveBeenCalled();
      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
    });

    it("lists with active filter defaulting to true (only active)", async () => {
      mockList.mockResolvedValue({ ok: true, data: [] });

      await handlers.get("lesson_read")!({ projectId: PROJECT_ID });

      expect(mockList).toHaveBeenCalledWith(PROJECT_ID, "active");
    });

    it("lists all when active=false", async () => {
      mockList.mockResolvedValue({ ok: true, data: [] });

      await handlers.get("lesson_read")!({ projectId: PROJECT_ID, active: false });

      expect(mockList).toHaveBeenCalledWith(PROJECT_ID, undefined);
    });

    it("filters by category in-memory", async () => {
      const entries = [
        { id: "1", issueType: "style", description: "d" },
        { id: "2", issueType: "pacing", description: "d" },
        { id: "3", issueType: "style", description: "d" },
      ];
      mockList.mockResolvedValue({ ok: true, data: entries });

      const result = await handlers.get("lesson_read")!({
        projectId: PROJECT_ID,
        category: "style",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as typeof entries;
      expect(data).toHaveLength(2);
      expect(data.every((e) => e.issueType === "style")).toBe(true);
    });

    it("returns error when list service fails", async () => {
      mockList.mockResolvedValue({
        ok: false,
        error: { code: "INTERNAL", message: "DB error" },
      });

      const result = await handlers.get("lesson_read")!({ projectId: PROJECT_ID });
      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // lesson_update
  // ---------------------------------------------------------------------------
  describe("lesson_update", () => {
    it("merges pattern update with existing correction", async () => {
      const existingDesc = `旧问题${DESC_SEPARATOR}旧修正`;
      mockRead.mockResolvedValue({
        ok: true,
        data: { id: LESSON_ID, description: existingDesc },
      });
      mockUpdate.mockResolvedValue({ ok: true, data: {} });

      const result = await handlers.get("lesson_update")!({
        projectId: PROJECT_ID,
        lessonId: LESSON_ID,
        pattern: "新问题",
      });

      expect(mockUpdate).toHaveBeenCalledWith(LESSON_ID, {
        description: `新问题${DESC_SEPARATOR}旧修正`,
      });
      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect((payload.data as { id: string }).id).toBe(LESSON_ID);
    });

    it("merges correction update with existing pattern", async () => {
      const existingDesc = `旧问题${DESC_SEPARATOR}旧修正`;
      mockRead.mockResolvedValue({
        ok: true,
        data: { id: LESSON_ID, description: existingDesc },
      });
      mockUpdate.mockResolvedValue({ ok: true, data: {} });

      await handlers.get("lesson_update")!({
        projectId: PROJECT_ID,
        lessonId: LESSON_ID,
        correction: "新修正",
      });

      expect(mockUpdate).toHaveBeenCalledWith(LESSON_ID, {
        description: `旧问题${DESC_SEPARATOR}新修正`,
      });
    });

    it("updates category (issueType)", async () => {
      mockUpdate.mockResolvedValue({ ok: true, data: {} });

      await handlers.get("lesson_update")!({
        projectId: PROJECT_ID,
        lessonId: LESSON_ID,
        category: "worldbuilding",
      });

      expect(mockRead).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith(LESSON_ID, {
        issueType: "worldbuilding",
      });
    });

    it("maps active=true→status active", async () => {
      mockUpdate.mockResolvedValue({ ok: true, data: {} });

      await handlers.get("lesson_update")!({
        projectId: PROJECT_ID,
        lessonId: LESSON_ID,
        active: true,
      });

      expect(mockUpdate).toHaveBeenCalledWith(LESSON_ID, { status: "active" });
    });

    it("maps active=false→status archived", async () => {
      mockUpdate.mockResolvedValue({ ok: true, data: {} });

      await handlers.get("lesson_update")!({
        projectId: PROJECT_ID,
        lessonId: LESSON_ID,
        active: false,
      });

      expect(mockUpdate).toHaveBeenCalledWith(LESSON_ID, { status: "archived" });
    });

    it("returns NOT_FOUND when read fails during pattern/correction update", async () => {
      mockRead.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Not found" },
      });

      const result = await handlers.get("lesson_update")!({
        projectId: PROJECT_ID,
        lessonId: LESSON_ID,
        pattern: "new pattern",
      });

      expect(mockUpdate).not.toHaveBeenCalled();
      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect((payload.error as { code: string }).code).toBe("NOT_FOUND");
    });

    it("returns NO_FIELDS error when no update fields provided", async () => {
      const result = await handlers.get("lesson_update")!({
        projectId: PROJECT_ID,
        lessonId: LESSON_ID,
      });

      expect(mockUpdate).not.toHaveBeenCalled();
      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect((payload.error as { code: string }).code).toBe("NO_FIELDS");
    });
  });
});
