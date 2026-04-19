import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockServer, parseResponse } from "../helpers.js";

const { mockCreate, mockRead, mockList, mockUpdate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockRead: vi.fn(),
  mockList: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@moran/core/services", () => ({
  threadService: {
    create: mockCreate,
    read: mockRead,
    list: mockList,
    update: mockUpdate,
  },
}));

import { registerThreadTools } from "../../tools/thread.js";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const THREAD_ID = "00000000-0000-0000-0000-000000000021";

describe("thread tools", () => {
  const { server, handlers } = createMockServer();
  registerThreadTools(server);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("thread_create", () => {
    it("maps title→name, plantedChapter→introducedChapter, expectedPayoff→resolvedChapter", async () => {
      mockCreate.mockResolvedValue({
        ok: true,
        data: { id: THREAD_ID, name: "神秘令牌" },
      });

      const result = await handlers.get("thread_create")!({
        projectId: PROJECT_ID,
        title: "神秘令牌",
        description: "主角在第一章发现的神秘令牌",
        plantedChapter: 1,
        expectedPayoff: 20,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(PROJECT_ID, {
        name: "神秘令牌",
        description: "主角在第一章发现的神秘令牌",
        introducedChapter: 1,
        resolvedChapter: 20,
        status: "planted",
      });
    });

    it("creates thread without expectedPayoff", async () => {
      mockCreate.mockResolvedValue({ ok: true, data: { id: THREAD_ID } });

      await handlers.get("thread_create")!({
        projectId: PROJECT_ID,
        title: "悬念",
        description: "描述",
        plantedChapter: 3,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        PROJECT_ID,
        expect.objectContaining({
          resolvedChapter: undefined,
          status: "planted",
        }),
      );
    });

    it("propagates service error", async () => {
      mockCreate.mockResolvedValue({
        ok: false,
        error: { code: "INTERNAL", message: "创建失败" },
      });

      const result = await handlers.get("thread_create")!({
        projectId: PROJECT_ID,
        title: "伏笔",
        description: "描述",
        plantedChapter: 1,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("INTERNAL");
    });
  });

  describe("thread_read", () => {
    it("reads single thread by threadId", async () => {
      mockRead.mockResolvedValue({
        ok: true,
        data: { id: THREAD_ID, name: "神秘令牌", status: "planted" },
      });

      const result = await handlers.get("thread_read")!({
        projectId: PROJECT_ID,
        threadId: THREAD_ID,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockRead).toHaveBeenCalledWith(PROJECT_ID, THREAD_ID);
      expect(mockList).not.toHaveBeenCalled();
    });

    it("filters active threads (planted + developing)", async () => {
      mockList.mockResolvedValue({
        ok: true,
        data: [
          { id: "t1", status: "planted" },
          { id: "t2", status: "developing" },
          { id: "t3", status: "resolved" },
          { id: "t4", status: "stale" },
        ],
      });

      const result = await handlers.get("thread_read")!({
        projectId: PROJECT_ID,
        status: "active",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as Array<{ id: string }>;
      expect(data).toHaveLength(2);
      expect(data.map((t) => t.id)).toEqual(["t1", "t2"]);
    });

    it("filters resolved threads", async () => {
      mockList.mockResolvedValue({
        ok: true,
        data: [{ id: "t1", status: "resolved" }],
      });

      const result = await handlers.get("thread_read")!({
        projectId: PROJECT_ID,
        status: "resolved",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockList).toHaveBeenCalledWith(PROJECT_ID, "resolved");
    });

    it("filters abandoned threads (maps to stale)", async () => {
      mockList.mockResolvedValue({
        ok: true,
        data: [{ id: "t1", status: "stale" }],
      });

      const result = await handlers.get("thread_read")!({
        projectId: PROJECT_ID,
        status: "abandoned",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockList).toHaveBeenCalledWith(PROJECT_ID, "stale");
    });

    it("filters by chapterNumber — threads planted at or before chapter", async () => {
      mockList.mockResolvedValue({
        ok: true,
        data: [
          { id: "t1", introducedChapter: 1, status: "planted" },
          { id: "t2", introducedChapter: 5, status: "developing" },
          { id: "t3", introducedChapter: 10, status: "planted" },
          { id: "t4", introducedChapter: 3, status: "resolved" },
        ],
      });

      const result = await handlers.get("thread_read")!({
        projectId: PROJECT_ID,
        chapterNumber: 6,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as Array<{ id: string }>;
      // t1 (ch1, planted), t2 (ch5, developing) — t3 is ch10 (too late), t4 is resolved
      expect(data.map((t) => t.id)).toEqual(["t1", "t2"]);
    });

    it("returns all threads when no filters", async () => {
      mockList.mockResolvedValue({
        ok: true,
        data: [{ id: "t1" }, { id: "t2" }],
      });

      const result = await handlers.get("thread_read")!({ projectId: PROJECT_ID });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockList).toHaveBeenCalledWith(PROJECT_ID);
    });
  });

  describe("thread_update", () => {
    it("maps advance action to developing status", async () => {
      mockRead.mockResolvedValue({
        ok: true,
        data: { id: THREAD_ID, description: "原始描述", status: "planted" },
      });
      mockUpdate.mockResolvedValue({
        ok: true,
        data: { id: THREAD_ID, status: "developing" },
      });

      const result = await handlers.get("thread_update")!({
        projectId: PROJECT_ID,
        threadId: THREAD_ID,
        action: "advance",
        chapterNumber: 5,
        note: "伏笔在第五章展开",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        THREAD_ID,
        expect.objectContaining({ status: "developing" }),
      );
    });

    it("maps resolve action to resolved status", async () => {
      mockRead.mockResolvedValue({
        ok: true,
        data: { id: THREAD_ID, description: "描述", status: "developing" },
      });
      mockUpdate.mockResolvedValue({
        ok: true,
        data: { id: THREAD_ID, status: "resolved" },
      });

      await handlers.get("thread_update")!({
        projectId: PROJECT_ID,
        threadId: THREAD_ID,
        action: "resolve",
        chapterNumber: 20,
        note: "伏笔回收",
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        THREAD_ID,
        expect.objectContaining({ status: "resolved" }),
      );
    });

    it("maps abandon action to stale status", async () => {
      mockRead.mockResolvedValue({
        ok: true,
        data: { id: THREAD_ID, description: "描述", status: "planted" },
      });
      mockUpdate.mockResolvedValue({
        ok: true,
        data: { id: THREAD_ID, status: "stale" },
      });

      await handlers.get("thread_update")!({
        projectId: PROJECT_ID,
        threadId: THREAD_ID,
        action: "abandon",
        chapterNumber: 15,
        note: "废弃此伏笔",
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        THREAD_ID,
        expect.objectContaining({ status: "stale" }),
      );
    });

    it("appends action log to description", async () => {
      mockRead.mockResolvedValue({
        ok: true,
        data: { id: THREAD_ID, description: "原始描述", status: "planted" },
      });
      mockUpdate.mockResolvedValue({ ok: true, data: { id: THREAD_ID } });

      await handlers.get("thread_update")!({
        projectId: PROJECT_ID,
        threadId: THREAD_ID,
        action: "advance",
        chapterNumber: 7,
        note: "展开说明",
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        THREAD_ID,
        expect.objectContaining({
          description: "原始描述\n[Ch.7] advance: 展开说明",
        }),
      );
    });

    it("returns NOT_FOUND when thread missing", async () => {
      mockRead.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "伏笔不存在" },
      });

      const result = await handlers.get("thread_update")!({
        projectId: PROJECT_ID,
        threadId: THREAD_ID,
        action: "advance",
        chapterNumber: 5,
        note: "note",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });
  });
});
