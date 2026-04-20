import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock all 8 dependent services ──────────────────────────────────────────

vi.mock("../outline.service.js", () => ({
  readOutline: vi.fn(),
  listArcs: vi.fn(),
}));

vi.mock("../world.service.js", () => ({
  listSettings: vi.fn(),
}));

vi.mock("../character.service.js", () => ({
  list: vi.fn(),
}));

vi.mock("../summary.service.js", () => ({
  listChapterSummaries: vi.fn(),
}));

vi.mock("../style.service.js", () => ({
  list: vi.fn(),
}));

vi.mock("../lesson.service.js", () => ({
  list: vi.fn(),
}));

vi.mock("../thread.service.js", () => ({
  list: vi.fn(),
}));

vi.mock("../chapter.service.js", () => ({
  readBrief: vi.fn(),
}));

// ── Imports after mocks ────────────────────────────────────────────────────

import * as outlineService from "../outline.service.js";
import * as worldService from "../world.service.js";
import * as characterService from "../character.service.js";
import * as summaryService from "../summary.service.js";
import * as styleService from "../style.service.js";
import * as lessonService from "../lesson.service.js";
import * as threadService from "../thread.service.js";
import * as chapterService from "../chapter.service.js";

import { assemble } from "../context.service.js";

// ── Mock helpers ───────────────────────────────────────────────────────────

const PROJECT_ID = "proj-1";
const CHAPTER_NUM = 3;

const MOCK_OUTLINE = {
  id: "out-1",
  projectId: PROJECT_ID,
  synopsis: "测试大纲",
  structureType: null,
  themes: null,
  createdAt: new Date(),
};

const MOCK_ARC = {
  id: "arc-1",
  projectId: PROJECT_ID,
  arcIndex: 0,
  title: "第一弧段",
  description: "弧段描述",
  startChapter: 1,
  endChapter: 5,
  detailedPlan: "这是弧段的详细计划",
  createdAt: new Date(),
};

const MOCK_BRIEF = {
  id: "brief-1",
  projectId: PROJECT_ID,
  chapterNumber: CHAPTER_NUM,
  arcIndex: 0,
  type: "hard" as const,
  hardConstraints: { rule: "必须发生冲突" },
  softGuidance: null,
  freeZone: ["可自由发挥的部分"],
  emotionalLandmine: "主角的伤痛",
  scenesSequelStructure: null,
  status: "draft" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_SETTINGS = [
  {
    id: "set-1",
    projectId: PROJECT_ID,
    section: "magic",
    name: "魔法系统",
    content: "火球术描述",
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const MOCK_CHARACTERS = [
  {
    id: "c-1",
    projectId: PROJECT_ID,
    name: "主角",
    aliases: null,
    role: "protagonist" as const,
    description: "主角描述",
    personality: "勇敢",
    background: "孤儿出身",
    goals: ["复仇"],
    firstAppearance: 1,
    arc: null,
    profileContent: null,
    wound: null,
    designTier: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const MOCK_SUMMARIES = [
  {
    id: "s-1",
    projectId: PROJECT_ID,
    chapterNumber: 1,
    content: "第一章的摘要",
    version: 1,
    createdAt: new Date(),
  },
  {
    id: "s-2",
    projectId: PROJECT_ID,
    chapterNumber: 2,
    content: "第二章的摘要",
    version: 1,
    createdAt: new Date(),
  },
];

const MOCK_STYLES = [
  {
    id: "st-1",
    projectId: PROJECT_ID,
    styleId: "yunmo",
    displayName: "执笔·云墨",
    genre: null,
    description: "均衡万用，自然流畅",
    source: "builtin" as const,
    forkedFrom: null,
    version: 1,
    modules: null,
    reviewerFocus: null,
    contextWeights: null,
    tone: null,
    forbidden: null,
    encouraged: null,
    proseGuide: "自然流畅的散文风格指引",
    examples: null,
    isActive: true,
    userId: "local",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const MOCK_LESSONS = [
  {
    id: "l-1",
    projectId: PROJECT_ID,
    status: "active" as const,
    severity: "major" as const,
    title: "避免AI腔",
    description: "不要使用机械化的表达",
    sourceChapter: 1,
    sourceAgent: "mingjing",
    issueType: "ai_flavor",
    tags: null,
    lastTriggeredChapter: null,
    triggerCount: 0,
    inactiveChapters: 0,
    expiryThreshold: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const MOCK_THREADS = [
  {
    id: "t-1",
    projectId: PROJECT_ID,
    name: "秘密身份",
    description: "主角隐藏的真实身份",
    status: "planted" as const,
    introducedChapter: 1,
    resolvedChapter: null,
    relatedCharacterIds: null,
    keyMoments: null,
    createdAt: new Date(),
  },
];

function setupSuccessMocks() {
  vi.mocked(outlineService.readOutline).mockResolvedValue({
    ok: true,
    data: MOCK_OUTLINE,
  });
  vi.mocked(outlineService.listArcs).mockResolvedValue({
    ok: true,
    data: [MOCK_ARC],
  });
  vi.mocked(chapterService.readBrief).mockResolvedValue({
    ok: true,
    data: MOCK_BRIEF,
  });
  vi.mocked(worldService.listSettings).mockResolvedValue({
    ok: true,
    data: MOCK_SETTINGS,
  });
  vi.mocked(characterService.list).mockResolvedValue({
    ok: true,
    data: MOCK_CHARACTERS,
  });
  vi.mocked(summaryService.listChapterSummaries).mockResolvedValue({
    ok: true,
    data: MOCK_SUMMARIES,
  });
  vi.mocked(styleService.list).mockResolvedValue({
    ok: true,
    data: MOCK_STYLES,
  });
  vi.mocked(lessonService.list).mockResolvedValue({
    ok: true,
    data: MOCK_LESSONS,
  });
  vi.mocked(threadService.list).mockResolvedValue({
    ok: true,
    data: MOCK_THREADS,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("context.service", () => {
  describe("AC-CTX-1: write mode returns all 8 fields non-empty", () => {
    it("returns complete payload with all fields populated", async () => {
      setupSuccessMocks();

      const result = await assemble(PROJECT_ID, CHAPTER_NUM, "write");

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { data } = result;
      expect(data.brief).toBeTruthy();
      expect(data.worldContext).toBeTruthy();
      expect(data.characterStates).toBeTruthy();
      expect(data.previousSummary).toBeTruthy();
      expect(data.styleConfig).toBeTruthy();
      expect(data.lessons.length).toBeGreaterThan(0);
      expect(data.threads.length).toBeGreaterThan(0);
      expect(data.arcContext).toBeTruthy();
      expect(data.tokenBudget).toBeDefined();
    });

    it("formats brief from chapterBrief data", async () => {
      setupSuccessMocks();

      const result = await assemble(PROJECT_ID, CHAPTER_NUM, "write");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.brief).toContain("[类型: hard]");
      expect(result.data.brief).toContain("情感地雷");
    });

    it("formats arcContext with arc title and chapter range", async () => {
      setupSuccessMocks();

      const result = await assemble(PROJECT_ID, CHAPTER_NUM, "write");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.arcContext).toContain("第一弧段");
      expect(result.data.arcContext).toContain("第1章");
    });
  });

  describe("AC-CTX-2: revise mode returns only brief + styleConfig + lessons", () => {
    it("revise mode has empty world/character/summary/threads/arcContext fields", async () => {
      setupSuccessMocks();

      const result = await assemble(PROJECT_ID, CHAPTER_NUM, "revise");

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { data } = result;
      expect(data.brief).toBeTruthy();
      expect(data.styleConfig).toBeTruthy();
      expect(data.lessons.length).toBeGreaterThan(0);

      expect(data.worldContext).toBe("");
      expect(data.characterStates).toBe("");
      expect(data.previousSummary).toBeNull();
      expect(data.threads).toEqual([]);
      expect(data.arcContext).toBe("");
    });

    it("revise mode does NOT call worldService or characterService", async () => {
      setupSuccessMocks();

      await assemble(PROJECT_ID, CHAPTER_NUM, "revise");

      expect(worldService.listSettings).not.toHaveBeenCalled();
      expect(characterService.list).not.toHaveBeenCalled();
      expect(summaryService.listChapterSummaries).not.toHaveBeenCalled();
      expect(threadService.list).not.toHaveBeenCalled();
    });
  });

  describe("AC-CTX-3: rewrite mode returns 6 fields, no old chapter text", () => {
    it("rewrite mode returns all payload fields including world and character", async () => {
      setupSuccessMocks();

      const result = await assemble(PROJECT_ID, CHAPTER_NUM, "rewrite");

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { data } = result;
      expect(data.brief).toBeTruthy();
      expect(data.worldContext).toBeTruthy();
      expect(data.characterStates).toBeTruthy();
      expect(data.previousSummary).toBeTruthy();
      expect(data.styleConfig).toBeTruthy();
      expect(data.arcContext).toBeTruthy();
    });

    it("rewrite mode tokenBudget uses REWRITE limits", async () => {
      setupSuccessMocks();

      const result = await assemble(PROJECT_ID, CHAPTER_NUM, "rewrite");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.tokenBudget.previousSummary).toBe(6000);
      expect(result.data.tokenBudget.worldContext).toBe(5000);
    });
  });

  describe("AC-CTX-4: chapter 1 previousSummary is null", () => {
    it("returns null previousSummary for chapter 1", async () => {
      setupSuccessMocks();
      vi.mocked(chapterService.readBrief).mockResolvedValue({
        ok: true,
        data: { ...MOCK_BRIEF, chapterNumber: 1 },
      });
      // summaries exist but chapter 1 has no "previous" chapters
      vi.mocked(summaryService.listChapterSummaries).mockResolvedValue({
        ok: true,
        data: [
          {
            id: "s-1",
            projectId: PROJECT_ID,
            chapterNumber: 0,
            content: "序章",
            version: 1,
            createdAt: new Date(),
          },
        ],
      });

      const result = await assemble(PROJECT_ID, 1, "write");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.previousSummary).toBeNull();
    });
  });

  describe("AC-CTX-5: missing outline returns error", () => {
    it("returns error when outline does not exist", async () => {
      vi.mocked(outlineService.readOutline).mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "大纲不存在" },
      });

      const result = await assemble(PROJECT_ID, CHAPTER_NUM, "write");

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.message).toBe("大纲不存在");
    });
  });

  describe("AC-CTX-5b: missing chapter brief returns error", () => {
    it("returns error when chapter brief does not exist", async () => {
      vi.mocked(outlineService.readOutline).mockResolvedValue({
        ok: true,
        data: MOCK_OUTLINE,
      });
      vi.mocked(chapterService.readBrief).mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "章节详案不存在" },
      });

      const result = await assemble(PROJECT_ID, CHAPTER_NUM, "write");

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.message).toBe("该章节的 Brief 不存在");
    });
  });

  describe("AC-CTX-6: tokenBudget differs by mode", () => {
    it("write mode uses BUDGET_WRITE with previousSummary=8000", async () => {
      setupSuccessMocks();

      const result = await assemble(PROJECT_ID, CHAPTER_NUM, "write");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.tokenBudget.previousSummary).toBe(8000);
      expect(result.data.tokenBudget.worldContext).toBe(6000);
    });

    it("revise mode uses BUDGET_REVISE with only 3 keys", async () => {
      setupSuccessMocks();

      const result = await assemble(PROJECT_ID, CHAPTER_NUM, "revise");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(Object.keys(result.data.tokenBudget)).toHaveLength(3);
      expect(result.data.tokenBudget.brief).toBe(4000);
      expect(result.data.tokenBudget.styleConfig).toBe(3000);
      expect(result.data.tokenBudget.lessons).toBe(2000);
    });

    it("rewrite mode uses BUDGET_REWRITE with previousSummary=6000", async () => {
      setupSuccessMocks();

      const result = await assemble(PROJECT_ID, CHAPTER_NUM, "rewrite");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.tokenBudget.previousSummary).toBe(6000);
    });
  });

  describe("AC-CTX-7: sub-service failure produces empty field, not whole failure", () => {
    it("world service failure → worldContext is empty string, assembly still succeeds", async () => {
      setupSuccessMocks();
      vi.mocked(worldService.listSettings).mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "连接失败" },
      });

      const result = await assemble(PROJECT_ID, CHAPTER_NUM, "write");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.worldContext).toBe("");
      // other fields still populated
      expect(result.data.brief).toBeTruthy();
      expect(result.data.characterStates).toBeTruthy();
    });

    it("character service failure → characterStates is empty string, assembly still succeeds", async () => {
      setupSuccessMocks();
      vi.mocked(characterService.list).mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "连接失败" },
      });

      const result = await assemble(PROJECT_ID, CHAPTER_NUM, "write");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.characterStates).toBe("");
      expect(result.data.worldContext).toBeTruthy();
    });

    it("summary service failure → previousSummary is null, assembly still succeeds", async () => {
      setupSuccessMocks();
      vi.mocked(summaryService.listChapterSummaries).mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "连接失败" },
      });

      const result = await assemble(PROJECT_ID, CHAPTER_NUM, "write");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.previousSummary).toBeNull();
    });

    it("lesson service failure → lessons is empty array, assembly still succeeds", async () => {
      setupSuccessMocks();
      vi.mocked(lessonService.list).mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "连接失败" },
      });

      const result = await assemble(PROJECT_ID, CHAPTER_NUM, "write");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.lessons).toEqual([]);
    });

    it("thread service failure → threads is empty array, assembly still succeeds", async () => {
      setupSuccessMocks();
      vi.mocked(threadService.list).mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "连接失败" },
      });

      const result = await assemble(PROJECT_ID, CHAPTER_NUM, "write");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.threads).toEqual([]);
    });
  });
});
