/**
 * Unit tests for knowledge tools.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockServer, parseResponse } from "../helpers.js";

const { mockCreate, mockRead, mockList, mockUpdate, mockRemove, mockPatch } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockRead: vi.fn(),
  mockList: vi.fn(),
  mockUpdate: vi.fn(),
  mockRemove: vi.fn(),
  mockPatch: vi.fn(),
}));

vi.mock("@moran/core/services", () => ({
  knowledgeService: {
    create: mockCreate,
    read: mockRead,
    list: mockList,
    update: mockUpdate,
    remove: mockRemove,
    patch: mockPatch,
  },
}));

import { registerKnowledgeTools } from "../../tools/knowledge.js";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const KNOWLEDGE_ID = "00000000-0000-0000-0000-000000000002";

describe("knowledge tools", () => {
  const { server, handlers } = createMockServer();
  registerKnowledgeTools(server);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // knowledge_create
  // ---------------------------------------------------------------------------
  describe("knowledge_create", () => {
    it("maps technique category to writing_craft and scope to project:{projectId}", async () => {
      mockCreate.mockResolvedValue({ ok: true, data: { id: KNOWLEDGE_ID } });

      const result = await handlers.get("knowledge_create")!({
        projectId: PROJECT_ID,
        category: "technique",
        title: "Show Don't Tell",
        content: "Avoid telling the reader how to feel.",
        tags: ["craft"],
      });

      expect(mockCreate).toHaveBeenCalledWith({
        scope: `project:${PROJECT_ID}`,
        category: "writing_craft",
        title: "Show Don't Tell",
        content: "Avoid telling the reader how to feel.",
        tags: ["craft"],
        source: "user",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
    });

    it("maps genre category to genre", async () => {
      mockCreate.mockResolvedValue({ ok: true, data: { id: KNOWLEDGE_ID } });

      await handlers.get("knowledge_create")!({
        projectId: PROJECT_ID,
        category: "genre",
        title: "Xianxia Tropes",
        content: "Cultivation stages, spirit stones...",
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ category: "genre" }),
      );
    });

    it("maps style category to style", async () => {
      mockCreate.mockResolvedValue({ ok: true, data: { id: KNOWLEDGE_ID } });

      await handlers.get("knowledge_create")!({
        projectId: PROJECT_ID,
        category: "style",
        title: "Minimalist prose",
        content: "Short sentences.",
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ category: "style" }),
      );
    });

    it("maps reference category to reference", async () => {
      mockCreate.mockResolvedValue({ ok: true, data: { id: KNOWLEDGE_ID } });

      await handlers.get("knowledge_create")!({
        projectId: PROJECT_ID,
        category: "reference",
        title: "Tang Dynasty customs",
        content: "...",
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ category: "reference" }),
      );
    });

    it("defaults tags to empty array when not provided", async () => {
      mockCreate.mockResolvedValue({ ok: true, data: { id: KNOWLEDGE_ID } });

      await handlers.get("knowledge_create")!({
        projectId: PROJECT_ID,
        category: "style",
        title: "T",
        content: "C",
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ tags: [] }),
      );
    });

    it("returns error when service fails", async () => {
      mockCreate.mockResolvedValue({
        ok: false,
        error: { code: "INTERNAL", message: "DB error" },
      });

      const result = await handlers.get("knowledge_create")!({
        projectId: PROJECT_ID,
        category: "technique",
        title: "T",
        content: "C",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // knowledge_read
  // ---------------------------------------------------------------------------
  describe("knowledge_read", () => {
    it("reads single entry by knowledgeId", async () => {
      const entry = { id: KNOWLEDGE_ID, title: "T", content: "C", tags: [] };
      mockRead.mockResolvedValue({ ok: true, data: entry });

      const result = await handlers.get("knowledge_read")!({
        projectId: PROJECT_ID,
        knowledgeId: KNOWLEDGE_ID,
      });

      expect(mockRead).toHaveBeenCalledWith(KNOWLEDGE_ID);
      expect(mockList).not.toHaveBeenCalled();
      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
    });

    it("lists entries with category filter (technique→writing_craft)", async () => {
      mockList.mockResolvedValue({ ok: true, data: [] });

      await handlers.get("knowledge_read")!({
        projectId: PROJECT_ID,
        category: "technique",
      });

      expect(mockList).toHaveBeenCalledWith(
        `project:${PROJECT_ID}`,
        "writing_craft",
      );
    });

    it("lists all entries when no category provided", async () => {
      mockList.mockResolvedValue({ ok: true, data: [] });

      await handlers.get("knowledge_read")!({ projectId: PROJECT_ID });

      expect(mockList).toHaveBeenCalledWith(`project:${PROJECT_ID}`, undefined);
    });

    it("filters by tags (AND logic)", async () => {
      const entries = [
        { id: "1", title: "A", content: "x", tags: ["craft", "pov"] },
        { id: "2", title: "B", content: "y", tags: ["craft"] },
        { id: "3", title: "C", content: "z", tags: ["pov"] },
      ];
      mockList.mockResolvedValue({ ok: true, data: entries });

      const result = await handlers.get("knowledge_read")!({
        projectId: PROJECT_ID,
        tags: ["craft", "pov"],
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as typeof entries;
      expect(data).toHaveLength(1);
      expect(data[0]!.id).toBe("1");
    });

    it("filters by full-text query (case-insensitive, title+content)", async () => {
      const entries = [
        { id: "1", title: "Show Don't Tell", content: "avoid telling", tags: [] },
        { id: "2", title: "Pacing", content: "rhythm of scenes", tags: [] },
      ];
      mockList.mockResolvedValue({ ok: true, data: entries });

      const result = await handlers.get("knowledge_read")!({
        projectId: PROJECT_ID,
        query: "TELL",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as typeof entries;
      expect(data).toHaveLength(1);
      expect(data[0]!.id).toBe("1");
    });

    it("applies both tag and query filters together", async () => {
      const entries = [
        { id: "1", title: "Show Don't Tell", content: "avoid telling", tags: ["craft"] },
        { id: "2", title: "Show Don't Tell", content: "avoid telling", tags: ["other"] },
        { id: "3", title: "Pacing", content: "rhythm", tags: ["craft"] },
      ];
      mockList.mockResolvedValue({ ok: true, data: entries });

      const result = await handlers.get("knowledge_read")!({
        projectId: PROJECT_ID,
        tags: ["craft"],
        query: "tell",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as typeof entries;
      expect(data).toHaveLength(1);
      expect(data[0]!.id).toBe("1");
    });

    it("returns error when list service fails", async () => {
      mockList.mockResolvedValue({
        ok: false,
        error: { code: "INTERNAL", message: "DB error" },
      });

      const result = await handlers.get("knowledge_read")!({ projectId: PROJECT_ID });
      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // knowledge_update
  // ---------------------------------------------------------------------------
  describe("knowledge_update", () => {
    it("updates title only", async () => {
      mockUpdate.mockResolvedValue({ ok: true, data: {} });

      const result = await handlers.get("knowledge_update")!({
        projectId: PROJECT_ID,
        knowledgeId: KNOWLEDGE_ID,
        title: "New Title",
      });

      expect(mockUpdate).toHaveBeenCalledWith(KNOWLEDGE_ID, { title: "New Title" });
      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect((payload.data as { id: string }).id).toBe(KNOWLEDGE_ID);
    });

    it("updates content and tags", async () => {
      mockUpdate.mockResolvedValue({ ok: true, data: {} });

      await handlers.get("knowledge_update")!({
        projectId: PROJECT_ID,
        knowledgeId: KNOWLEDGE_ID,
        content: "Updated content",
        tags: ["new-tag"],
      });

      expect(mockUpdate).toHaveBeenCalledWith(KNOWLEDGE_ID, {
        content: "Updated content",
        tags: ["new-tag"],
      });
    });

    it("maps category technique→writing_craft on update", async () => {
      mockUpdate.mockResolvedValue({ ok: true, data: {} });

      await handlers.get("knowledge_update")!({
        projectId: PROJECT_ID,
        knowledgeId: KNOWLEDGE_ID,
        category: "technique",
      });

      expect(mockUpdate).toHaveBeenCalledWith(KNOWLEDGE_ID, {
        category: "writing_craft",
      });
    });

    it("returns NO_FIELDS error when no update fields provided", async () => {
      const result = await handlers.get("knowledge_update")!({
        projectId: PROJECT_ID,
        knowledgeId: KNOWLEDGE_ID,
      });

      expect(mockUpdate).not.toHaveBeenCalled();
      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect((payload.error as { code: string }).code).toBe("NO_FIELDS");
    });

    it("returns error when service fails", async () => {
      mockUpdate.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Not found" },
      });

      const result = await handlers.get("knowledge_update")!({
        projectId: PROJECT_ID,
        knowledgeId: KNOWLEDGE_ID,
        title: "T",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // knowledge_delete
  // ---------------------------------------------------------------------------
  describe("knowledge_delete", () => {
    it("deletes entry and returns id", async () => {
      mockRemove.mockResolvedValue({ ok: true, data: {} });

      const result = await handlers.get("knowledge_delete")!({
        projectId: PROJECT_ID,
        knowledgeId: KNOWLEDGE_ID,
      });

      expect(mockRemove).toHaveBeenCalledWith(KNOWLEDGE_ID);
      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      expect((payload.data as { id: string }).id).toBe(KNOWLEDGE_ID);
    });

    it("returns error when service fails", async () => {
      mockRemove.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Not found" },
      });

      const result = await handlers.get("knowledge_delete")!({
        projectId: PROJECT_ID,
        knowledgeId: KNOWLEDGE_ID,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // knowledge_patch
  // ---------------------------------------------------------------------------
  describe("knowledge_patch", () => {
    it("applies patches and returns applied count", async () => {
      mockRead.mockResolvedValue({
        ok: true,
        data: { id: KNOWLEDGE_ID, content: "Hello world, hello again." },
      });
      mockPatch.mockResolvedValue({ ok: true, data: {} });

      const result = await handlers.get("knowledge_patch")!({
        projectId: PROJECT_ID,
        knowledgeId: KNOWLEDGE_ID,
        patches: [{ find: "Hello", replace: "Hi" }],
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as { id: string; appliedCount: number };
      expect(data.id).toBe(KNOWLEDGE_ID);
      expect(data.appliedCount).toBeGreaterThan(0);
    });

    it("returns PATCH_NO_MATCH when no patches match", async () => {
      mockRead.mockResolvedValue({
        ok: true,
        data: { id: KNOWLEDGE_ID, content: "Hello world." },
      });

      const result = await handlers.get("knowledge_patch")!({
        projectId: PROJECT_ID,
        knowledgeId: KNOWLEDGE_ID,
        patches: [{ find: "NONEXISTENT_STRING_XYZ", replace: "nothing" }],
      });

      expect(mockPatch).not.toHaveBeenCalled();
      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect((payload.error as { code: string }).code).toBe("PATCH_NO_MATCH");
    });

    it("returns NOT_FOUND when read fails", async () => {
      mockRead.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Not found" },
      });

      const result = await handlers.get("knowledge_patch")!({
        projectId: PROJECT_ID,
        knowledgeId: KNOWLEDGE_ID,
        patches: [{ find: "x", replace: "y" }],
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect((payload.error as { code: string }).code).toBe("NOT_FOUND");
    });
  });
});
