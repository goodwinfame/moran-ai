import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Chainable query mock factory ───────────────────────────────────────────────
// Creates a thenable chain that all drizzle query methods return themselves from,
// and resolves with the given value when awaited.

function createChain(resolveWith: unknown) {
  const p = Promise.resolve(resolveWith);
  const chain: Record<string, unknown> = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    returning: vi.fn(() => p),
    // Make chain thenable so `await chain` resolves with the underlying promise
    then: (onf?: (v: unknown) => unknown, onr?: (e: unknown) => unknown) => p.then(onf, onr),
    catch: (onr?: (e: unknown) => unknown) => p.catch(onr),
    finally: (onf?: () => void) => p.finally(onf),
  };
  return chain;
}

// ── DB mock setup ──────────────────────────────────────────────────────────────

const mockSelect = vi.fn();

vi.mock("../../db/index.js", () => ({
  getDb: () => ({ select: mockSelect }),
}));

import { exportProject } from "../export.service.js";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── exportProject ──────────────────────────────────────────────────────────────

describe("exportProject", () => {
  const mockProject = { title: "我的小说" };

  const chapter1 = {
    id: "ch-1",
    projectId: "proj-1",
    chapterNumber: 1,
    title: "初遇",
    content: "第一章内容，英雄登场。",
    status: "archived",
    wordCount: 5,
    writerStyle: null,
    currentVersion: 1,
    archivedVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const chapter2 = {
    id: "ch-2",
    projectId: "proj-1",
    chapterNumber: 2,
    title: "离别",
    content: "第二章内容，故事继续。",
    status: "archived",
    wordCount: 5,
    writerStyle: null,
    currentVersion: 1,
    archivedVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // ── txt format ───────────────────────────────────────────────────────────────

  describe("txt format", () => {
    it("returns formatted txt content with chapter titles", async () => {
      mockSelect
        .mockReturnValueOnce(createChain([mockProject]))
        .mockReturnValueOnce(createChain([chapter1, chapter2]));

      const result = await exportProject({ projectId: "proj-1", format: "txt" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.filename).toBe("我的小说_export.txt");
      expect(result.data.content).toContain("第 1 章 初遇");
      expect(result.data.content).toContain("第一章内容，英雄登场。");
      expect(result.data.content).toContain("---");
      expect(result.data.content).toContain("第 2 章 离别");
      expect(result.data.content).toContain("第二章内容，故事继续。");
    });

    it("does NOT produce markdown headings for txt format", async () => {
      mockSelect
        .mockReturnValueOnce(createChain([mockProject]))
        .mockReturnValueOnce(createChain([chapter1]));

      const result = await exportProject({ projectId: "proj-1", format: "txt" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.content).not.toContain("# 第 1 章");
      expect(result.data.content).toContain("第 1 章 初遇");
    });
  });

  // ── md format ────────────────────────────────────────────────────────────────

  describe("md format", () => {
    it("returns markdown content with # headings", async () => {
      mockSelect
        .mockReturnValueOnce(createChain([mockProject]))
        .mockReturnValueOnce(createChain([chapter1]));

      const result = await exportProject({ projectId: "proj-1", format: "md" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.filename).toBe("我的小说_export.md");
      expect(result.data.content).toContain("# 第 1 章 初遇");
      expect(result.data.content).toContain("第一章内容，英雄登场。");
    });
  });

  // ── NOT_FOUND cases ───────────────────────────────────────────────────────────

  describe("NOT_FOUND errors", () => {
    it("returns NOT_FOUND when project does not exist", async () => {
      mockSelect.mockReturnValueOnce(createChain([]));

      const result = await exportProject({ projectId: "nonexistent", format: "txt" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.message).toBe("项目不存在");
      }
    });

    it("returns NOT_FOUND when no chapters have content", async () => {
      const emptyChapter = { ...chapter1, content: null, status: "draft" };
      mockSelect
        .mockReturnValueOnce(createChain([mockProject]))
        .mockReturnValueOnce(createChain([emptyChapter]));

      const result = await exportProject({ projectId: "proj-1", format: "txt" });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("returns NOT_FOUND when no chapters exist at all", async () => {
      mockSelect
        .mockReturnValueOnce(createChain([mockProject]))
        .mockReturnValueOnce(createChain([]));

      const result = await exportProject({ projectId: "proj-1", format: "txt" });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  // ── chapter range filtering ───────────────────────────────────────────────────

  describe("chapter range filtering", () => {
    it("uses chapters returned by DB when startChapter/endChapter are provided", async () => {
      // DB mock returns only chapter2 (simulating WHERE chapterNumber >= 2 AND <= 2)
      mockSelect
        .mockReturnValueOnce(createChain([mockProject]))
        .mockReturnValueOnce(createChain([chapter2]));

      const result = await exportProject({
        projectId: "proj-1",
        format: "txt",
        startChapter: 2,
        endChapter: 2,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.content).toContain("第 2 章 离别");
      expect(result.data.content).not.toContain("第 1 章");
    });
  });

  // ── includeTitle ──────────────────────────────────────────────────────────────

  describe("includeTitle option", () => {
    it("includes chapter titles by default (includeTitle = true)", async () => {
      mockSelect
        .mockReturnValueOnce(createChain([mockProject]))
        .mockReturnValueOnce(createChain([chapter1]));

      const result = await exportProject({ projectId: "proj-1", format: "txt" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.content).toContain("第 1 章 初遇");
    });

    it("omits chapter titles when includeTitle is false", async () => {
      mockSelect
        .mockReturnValueOnce(createChain([mockProject]))
        .mockReturnValueOnce(createChain([chapter1]));

      const result = await exportProject({
        projectId: "proj-1",
        format: "txt",
        includeTitle: false,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.content).not.toContain("第 1 章 初遇");
      expect(result.data.content).toContain("第一章内容，英雄登场。");
    });
  });

  // ── draft fallback ────────────────────────────────────────────────────────────

  describe("draft fallback", () => {
    it("includes draft chapters when no non-draft chapters with content exist", async () => {
      const draftChapter = { ...chapter1, status: "draft" };
      mockSelect
        .mockReturnValueOnce(createChain([mockProject]))
        .mockReturnValueOnce(createChain([draftChapter]));

      const result = await exportProject({ projectId: "proj-1", format: "txt" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.content).toContain("第一章内容，英雄登场。");
    });

    it("prefers non-draft chapters when both draft and non-draft exist", async () => {
      const draftChapter = {
        ...chapter1,
        id: "ch-draft",
        chapterNumber: 3,
        title: "草稿章节",
        content: "草稿内容",
        status: "draft",
      };
      mockSelect
        .mockReturnValueOnce(createChain([mockProject]))
        .mockReturnValueOnce(createChain([chapter1, draftChapter]));

      const result = await exportProject({ projectId: "proj-1", format: "txt" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Should only include the archived chapter, not the draft
      expect(result.data.content).toContain("第一章内容，英雄登场。");
      expect(result.data.content).not.toContain("草稿内容");
    });
  });

  // ── chapter with no title ─────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles chapter with null title gracefully", async () => {
      const untitledChapter = { ...chapter1, title: null };
      mockSelect
        .mockReturnValueOnce(createChain([mockProject]))
        .mockReturnValueOnce(createChain([untitledChapter]));

      const result = await exportProject({ projectId: "proj-1", format: "txt" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.content).toContain("第 1 章");
    });
  });
});
