import { describe, expect, it } from "vitest";
import {
  buildConsistencySystemPrompt,
  buildConsistencyUserMessage,
  buildRubricSystemPrompt,
  buildRubricUserMessage,
} from "../prompts.js";

describe("Review Prompts", () => {
  describe("buildConsistencySystemPrompt", () => {
    it("returns non-empty system prompt", () => {
      const prompt = buildConsistencySystemPrompt();
      expect(prompt.length).toBeGreaterThan(100);
    });

    it("includes all 5 detection dimensions", () => {
      const prompt = buildConsistencySystemPrompt();
      expect(prompt).toContain("角色行为一致性");
      expect(prompt).toContain("时间线连续性");
      expect(prompt).toContain("世界观遵守");
      expect(prompt).toContain("伏笔连续性");
      expect(prompt).toContain("空间一致性");
    });

    it("includes JSON output format instructions", () => {
      const prompt = buildConsistencySystemPrompt();
      expect(prompt).toContain("json");
      expect(prompt).toContain("issues");
    });

    it("includes severity levels", () => {
      const prompt = buildConsistencySystemPrompt();
      expect(prompt).toContain("critical");
      expect(prompt).toContain("major");
      expect(prompt).toContain("minor");
      expect(prompt).toContain("suggestion");
    });
  });

  describe("buildConsistencyUserMessage", () => {
    it("includes chapter number and content", () => {
      const msg = buildConsistencyUserMessage("章节内容...", 5);
      expect(msg).toContain("第 5 章");
      expect(msg).toContain("章节内容...");
    });

    it("includes context when provided", () => {
      const msg = buildConsistencyUserMessage("内容", 1, {
        characterProfiles: "李长安：剑修",
        worldRules: "九层修炼体系",
        timeline: "第一天上午",
        activeForeshadowing: "伏笔：神秘宝剑",
        recentSummaries: "上章摘要...",
        reviewerFocus: ["力量体系一致性", "战斗场景节奏"],
      });

      expect(msg).toContain("角色档案");
      expect(msg).toContain("李长安：剑修");
      expect(msg).toContain("世界设定规则");
      expect(msg).toContain("九层修炼体系");
      expect(msg).toContain("时间线");
      expect(msg).toContain("活跃伏笔");
      expect(msg).toContain("前几章摘要");
      expect(msg).toContain("审校特别关注");
      expect(msg).toContain("力量体系一致性");
    });

    it("omits empty context sections", () => {
      const msg = buildConsistencyUserMessage("内容", 1, {});
      expect(msg).not.toContain("角色档案");
      expect(msg).not.toContain("世界设定规则");
      expect(msg).toContain("章节正文");
    });

    it("works without context", () => {
      const msg = buildConsistencyUserMessage("内容", 1);
      expect(msg).toContain("第 1 章");
      expect(msg).toContain("章节正文");
    });
  });

  describe("buildRubricSystemPrompt", () => {
    it("returns non-empty system prompt", () => {
      const prompt = buildRubricSystemPrompt();
      expect(prompt.length).toBeGreaterThan(100);
    });

    it("includes all 7 RUBRIC dimensions", () => {
      const prompt = buildRubricSystemPrompt();
      expect(prompt).toContain("叙事节奏");
      expect(prompt).toContain("冲突张力");
      expect(prompt).toContain("人物深度");
      expect(prompt).toContain("对话自然度");
      expect(prompt).toContain("情感共鸣");
      expect(prompt).toContain("呆板度检测");
      expect(prompt).toContain("创意独特性");
    });

    it("includes staleness sub-dimensions", () => {
      const prompt = buildRubricSystemPrompt();
      expect(prompt).toContain("行为可预测性");
      expect(prompt).toContain("情感同时性");
      expect(prompt).toContain("反期待时刻");
      expect(prompt).toContain("非理性行为");
    });

    it("includes scoring standards", () => {
      const prompt = buildRubricSystemPrompt();
      expect(prompt).toContain("9-10");
      expect(prompt).toContain("8-8.9");
      expect(prompt).toContain("7-7.9");
    });

    it("includes JSON output format", () => {
      const prompt = buildRubricSystemPrompt();
      expect(prompt).toContain("dimensionId");
      expect(prompt).toContain("overallComment");
    });
  });

  describe("buildRubricUserMessage", () => {
    it("includes chapter number and content", () => {
      const msg = buildRubricUserMessage("章节内容...", 3);
      expect(msg).toContain("第 3 章");
      expect(msg).toContain("章节内容...");
    });

    it("includes chapter type when provided", () => {
      const msg = buildRubricUserMessage("内容", 1, "emotional");
      expect(msg).toContain("章节类型：emotional");
    });

    it("includes style display name when provided", () => {
      const msg = buildRubricUserMessage("内容", 1, undefined, "执笔·剑心");
      expect(msg).toContain("当前风格：执笔·剑心");
    });

    it("works with minimal params", () => {
      const msg = buildRubricUserMessage("内容", 1);
      expect(msg).toContain("章节正文");
      expect(msg).not.toContain("章节类型");
      expect(msg).not.toContain("当前风格");
    });
  });
});
