import { describe, expect, it, vi, beforeEach } from "vitest";

const mockSelectOrderBy = vi.fn();
const mockSelectWhere = vi.fn(() => ({ orderBy: mockSelectOrderBy }));
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

vi.mock("../../db/index.js", () => ({
  getDb: () => ({ select: mockSelect }),
}));

import { check } from "../consistency.service.js";

// Helper to build a minimal world setting row
function makeSetting(
  overrides: Partial<{
    id: string;
    projectId: string;
    section: string;
    name: string | null;
    content: string;
    sortOrder: number | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  }>,
) {
  return {
    id: "s1",
    projectId: "proj-1",
    section: "geography",
    name: null,
    content: "",
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("consistency.service", () => {
  // Test 1: No settings
  describe("check — no settings", () => {
    it("returns passed=true with empty issues and all-zero summary", async () => {
      mockSelectOrderBy.mockResolvedValue([]);
      const result = await check("proj-1");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.passed).toBe(true);
      expect(result.data.issues).toEqual([]);
      expect(result.data.summary).toEqual({ totalSettings: 0, checkedRules: 0, issueCount: 0 });
    });
  });

  // Test 2: Short content → missing_reference
  describe("check — short content", () => {
    it("reports missing_reference for each setting with content shorter than 20 chars", async () => {
      const settings = [
        makeSetting({ id: "s1", section: "faction", name: "龙族", content: "短内容" }),
        makeSetting({ id: "s2", section: "faction", name: "人族", content: "这是一个内容足够长的设定，超过二十个字符的详细描述" }),
      ];
      mockSelectOrderBy.mockResolvedValue(settings);
      const result = await check("proj-1");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const shortIssues = result.data.issues.filter((i) => i.type === "missing_reference");
      expect(shortIssues).toHaveLength(1);
      expect(shortIssues[0].severity).toBe("minor");
      expect(shortIssues[0].sources).toContain("s1");
      expect(shortIssues[0].description).toContain("龙族");
      expect(shortIssues[0].description).toContain("字符");
    });
  });

  // Test 3: Duplicate names within same section → contradiction
  describe("check — duplicate names", () => {
    it("reports contradiction for duplicate names within same section", async () => {
      const settings = [
        makeSetting({
          id: "s1",
          section: "faction",
          name: "龙族",
          content: "龙族是这个世界的主要种族之一，拥有悠久的历史和强大的魔法能力",
        }),
        makeSetting({
          id: "s2",
          section: "faction",
          name: "龙族",
          content: "另一个版本的龙族设定，描述了不同的起源故事和独特的社会结构组织",
        }),
      ];
      mockSelectOrderBy.mockResolvedValue(settings);
      const result = await check("proj-1");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const dupIssues = result.data.issues.filter((i) => i.type === "contradiction");
      expect(dupIssues).toHaveLength(1);
      expect(dupIssues[0].severity).toBe("major");
      expect(dupIssues[0].sources).toContain("s1");
      expect(dupIssues[0].sources).toContain("s2");
      expect(dupIssues[0].description).toContain("龙族");
      expect(dupIssues[0].description).toContain("faction");
      expect(result.data.passed).toBe(false);
    });

    it("does not flag duplicate names across different sections", async () => {
      const settings = [
        makeSetting({
          id: "s1",
          section: "faction",
          name: "龙族",
          content: "龙族是这个世界的主要种族之一，拥有悠久的历史和强大的魔法能力",
        }),
        makeSetting({
          id: "s2",
          section: "geography",
          name: "龙族",
          content: "龙族聚居地位于大陆东北方向的山脉深处，地形险峻气候严寒",
        }),
      ];
      mockSelectOrderBy.mockResolvedValue(settings);
      const result = await check("proj-1");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const dupIssues = result.data.issues.filter((i) => i.type === "contradiction");
      expect(dupIssues).toHaveLength(0);
    });
  });

  // Test 4: Cross-reference to non-existent term → orphan
  describe("check — cross-reference to missing term", () => {
    it("reports orphan for 「」references that don't match any setting name", async () => {
      const settings = [
        makeSetting({
          id: "s1",
          section: "faction",
          name: "人族",
          content: "人族是一个古老的种族，与「精灵族」有着悠久的友谊和历史渊源，共同守护大陆",
        }),
      ];
      mockSelectOrderBy.mockResolvedValue(settings);
      const result = await check("proj-1");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const refIssues = result.data.issues.filter(
        (i) => i.type === "orphan" && i.description.includes("精灵族"),
      );
      expect(refIssues.length).toBeGreaterThan(0);
      expect(refIssues[0].severity).toBe("minor");
      expect(refIssues[0].sources).toContain("s1");
      expect(refIssues[0].suggestion).toContain("精灵族");
    });

    it("does not flag 「」references that match another setting's name", async () => {
      const settings = [
        makeSetting({
          id: "s1",
          section: "setting",
          name: "魔法体系",
          content: "魔法体系建立在「元素法则」之上，通过意志力驱动自然元素进行施法",
        }),
        makeSetting({
          id: "s2",
          section: "setting",
          name: "元素法则",
          content: "元素法则是大陆运行的基本规律，自古以来便存在于世界的每个角落",
        }),
      ];
      mockSelectOrderBy.mockResolvedValue(settings);
      const result = await check("proj-1");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const refIssues = result.data.issues.filter(
        (i) => i.type === "orphan" && i.description.includes("元素法则"),
      );
      expect(refIssues).toHaveLength(0);
    });
  });

  // Test 5: Isolated subsystem setting → orphan
  describe("check — isolated settings", () => {
    it("reports orphan for non-base settings not referenced by any other setting", async () => {
      const settings = [
        makeSetting({
          id: "s1",
          section: "power_system",
          name: "元素魔法",
          content: "元素魔法系统参考了「孤立系统」，它是这个世界的核心战力体系",
        }),
        makeSetting({
          id: "s2",
          section: "power_system",
          name: "孤立系统",
          content: "一个独立的没有被外部引用的系统描述，详细说明其运作原理与限制",
        }),
      ];
      mockSelectOrderBy.mockResolvedValue(settings);
      const result = await check("proj-1");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // s1 name "元素魔法" does not appear in s2's content → s1 is isolated
      const isolatedS1 = result.data.issues.filter(
        (i) => i.type === "orphan" && i.sources.includes("s1") && i.description.includes("未被其他设定引用"),
      );
      expect(isolatedS1.length).toBeGreaterThan(0);
      // s2 name "孤立系统" appears in s1's content → s2 is NOT isolated
      const isolatedS2 = result.data.issues.filter(
        (i) => i.type === "orphan" && i.sources.includes("s2") && i.description.includes("未被其他设定引用"),
      );
      expect(isolatedS2).toHaveLength(0);
    });

    it("does not report orphan for settings with section='setting'", async () => {
      const settings = [
        makeSetting({
          id: "s1",
          section: "setting",
          name: "世界历史",
          content: "这个世界有着数千年的文明历史，从远古时代起便有各种种族在此繁衍生息",
        }),
      ];
      mockSelectOrderBy.mockResolvedValue(settings);
      const result = await check("proj-1");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const isolationIssues = result.data.issues.filter(
        (i) => i.type === "orphan" && i.description.includes("未被其他设定引用"),
      );
      expect(isolationIssues).toHaveLength(0);
    });
  });

  // Test 6: All clean settings → no issues
  describe("check — all clean settings", () => {
    it("returns passed=true with no issues when all settings are valid", async () => {
      const settings = [
        makeSetting({
          id: "s1",
          section: "setting",
          name: "世界背景",
          content: "这是一个魔法与科技并存的世界，人族和精灵族共同治理着这片大陆，历史悠久",
        }),
        makeSetting({
          id: "s2",
          section: "setting",
          name: "魔法体系",
          content: "魔法来源于大陆深处的能量节点，与「世界背景」密切相关，已有千年传承历史",
        }),
      ];
      mockSelectOrderBy.mockResolvedValue(settings);
      const result = await check("proj-1");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.passed).toBe(true);
      expect(result.data.issues).toEqual([]);
      expect(result.data.summary.totalSettings).toBe(2);
      expect(result.data.summary.checkedRules).toBe(4);
      expect(result.data.summary.issueCount).toBe(0);
    });
  });

  // Test 7: Mixed issues → summary counts, passed=false when major issue exists
  describe("check — mixed issues", () => {
    it("computes correct summary and sets passed=false when major issues exist", async () => {
      const settings = [
        makeSetting({
          id: "s1",
          section: "faction",
          name: "龙族",
          content: "龙族是主要力量，详细介绍他们的历史传承和社会结构以及文化特色",
        }),
        makeSetting({
          id: "s2",
          section: "faction",
          name: "龙族", // duplicate → contradiction (major)
          content: "重复的龙族设定，另一个版本的介绍，需要与第一条合并处理整合",
        }),
        makeSetting({
          id: "s3",
          section: "geography",
          name: "东部山脉",
          content: "短内容", // too short → missing_reference (minor)
        }),
      ];
      mockSelectOrderBy.mockResolvedValue(settings);
      const result = await check("proj-1");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.passed).toBe(false);
      expect(result.data.summary.totalSettings).toBe(3);
      expect(result.data.summary.checkedRules).toBe(4);
      expect(result.data.summary.issueCount).toBe(result.data.issues.length);
      expect(result.data.issues.some((i) => i.type === "contradiction")).toBe(true);
      expect(result.data.issues.some((i) => i.type === "missing_reference")).toBe(true);
    });

    it("sets passed=true when only minor issues exist", async () => {
      const settings = [
        makeSetting({
          id: "s1",
          section: "geography",
          name: "孤山",
          content: "短", // minor issue only (< 20 chars)
        }),
      ];
      mockSelectOrderBy.mockResolvedValue(settings);
      const result = await check("proj-1");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.passed).toBe(true);
      expect(result.data.issues.length).toBeGreaterThan(0);
      expect(result.data.issues.every((i) => i.severity === "minor")).toBe(true);
    });
  });
});
