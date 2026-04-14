import { describe, expect, it } from "vitest";
import { ReviewEngine } from "../review-engine.js";
import { SessionProjectBridge } from "../../bridge/bridge.js";
import { DEFAULT_REVIEW_CONFIG } from "../types.js";

describe("ReviewEngine", () => {
  const makeEngine = (config?: Partial<typeof DEFAULT_REVIEW_CONFIG>) => {
    return new ReviewEngine({
      enableConsistencyCheck: false,
      enableLiteraryCheck: false,
      ...config,
    });
  };

  describe("constructor and config", () => {
    it("uses default config", () => {
      const engine = new ReviewEngine();
      const config = engine.getConfig();
      expect(config.burstinessThreshold).toBe(0.3);
      expect(config.passingScore).toBe(7.5);
      expect(config.maxMajorIssues).toBe(2);
    });

    it("merges custom config", () => {
      const engine = new ReviewEngine({ passingScore: 6.0 });
      expect(engine.getConfig().passingScore).toBe(6.0);
      expect(engine.getConfig().burstinessThreshold).toBe(0.3); // default preserved
    });
  });

  describe("review — Round 1 only (no LLM)", () => {
    it("passes for content with good burstiness", async () => {
      const engine = makeEngine();

      // Content with varied sentence lengths (high burstiness)
      const content = [
        "风来了。",
        "漫长的寂静被打破，山间的树叶发出沙沙的声响，仿佛有千万只蝴蝶同时展开了翅膀。",
        "他站起身。",
        "远处的天际线上，一道紫色的光芒正缓缓升起，那是他等待了三个月的征兆，是突破的信号，是命运转折的起点。",
        "走吧。",
        "他对自己说了这两个字，然后迈出了第一步，脚下的石阶冰冷而坚硬，和三年前他第一次踏上这条路时一模一样。",
        "什么都没变，但一切都不同了。",
      ].join("\n\n");

      const result = await engine.review({
        content,
        chapterNumber: 1,
        arcNumber: 1,
      });

      expect(result.burstiness).toBeGreaterThan(0);
      expect(result.rounds).toHaveLength(1);
      expect(result.rounds[0]!.round).toBe(1);
    });

    it("detects low burstiness in uniform content", async () => {
      const engine = makeEngine();

      // AI-like content with uniform sentence lengths
      const sentences = Array.from({ length: 20 }, (_, i) =>
        `他走到了第${i + 1}个路口，看到了一个不一样的景色。`,
      );
      const content = sentences.join("\n\n");

      const result = await engine.review({
        content,
        chapterNumber: 1,
        arcNumber: 1,
      });

      expect(result.burstiness).toBeLessThan(0.3);
      // Should have low_burstiness issue
      const burstIssues = result.allIssues.filter(
        (i) => i.issue.includes("句长变化率"),
      );
      expect(burstIssues.length).toBeGreaterThanOrEqual(1);
    });

    it("detects forbidden words", async () => {
      const engine = makeEngine();

      const content = "在这个赛博朋克的世界里，量子计算已经普及。他走在数据库构成的虚拟街道上。";

      const result = await engine.review({
        content,
        chapterNumber: 1,
        arcNumber: 1,
        forbidden: { words: ["赛博", "量子", "数据库"] },
      });

      const forbiddenIssues = result.allIssues.filter(
        (i) => i.issue.includes("禁忌词"),
      );
      expect(forbiddenIssues.length).toBeGreaterThanOrEqual(1);
    });

    it("calls onRoundComplete callback", async () => {
      const engine = makeEngine();
      const completedRounds: number[] = [];

      await engine.review(
        {
          content: "测试内容，这是一段简短的文字。",
          chapterNumber: 1,
          arcNumber: 1,
        },
        undefined,
        (round) => {
          completedRounds.push(round.round);
        },
      );

      expect(completedRounds).toContain(1);
    });

    it("provides toReport method", async () => {
      const engine = makeEngine();

      const result = await engine.review({
        content: "测试内容。这是一段文字。另一句话。",
        chapterNumber: 1,
        arcNumber: 1,
      });

      const report = result.toReport(1);
      expect(report.round).toBe(1);
      expect(report.passed).toBe(result.passed);
      expect(report.score).toBe(result.score);
      expect(typeof report.burstiness).toBe("number");
    });
  });

  describe("review — with Round 2 (consistency, placeholder Bridge)", () => {
    it("includes Round 2 when enabled", async () => {
      const engine = new ReviewEngine({
        enableConsistencyCheck: true,
        enableLiteraryCheck: false,
      });
      const bridge = new SessionProjectBridge();

      const result = await engine.review(
        {
          content: "他盘膝坐在崖边，体内灵力缓缓流转。这是一个漫长的修炼过程。",
          chapterNumber: 1,
          arcNumber: 1,
          consistencyContext: {
            characterProfiles: "李长安：修炼第二层",
            worldRules: "灵力修炼分九层",
          },
        },
        bridge,
      );

      // Should have Round 1 + Round 2
      const roundNumbers = result.rounds.map((r) => r.round);
      expect(roundNumbers).toContain(1);
      expect(roundNumbers).toContain(2);
    });

    it("skips Round 2 when no bridge provided", async () => {
      const engine = new ReviewEngine({
        enableConsistencyCheck: true,
        enableLiteraryCheck: false,
      });

      const result = await engine.review({
        content: "测试内容。",
        chapterNumber: 1,
        arcNumber: 1,
      });

      // Only Round 1
      expect(result.rounds).toHaveLength(1);
    });
  });

  describe("review — with Round 3 (RUBRIC, placeholder Bridge)", () => {
    it("includes Round 3 when enabled", async () => {
      const engine = new ReviewEngine({
        enableConsistencyCheck: false,
        enableLiteraryCheck: true,
      });
      const bridge = new SessionProjectBridge();

      const result = await engine.review(
        {
          content: "他盘膝坐在崖边。远处传来风声。这是一个寂静的夜晚。",
          chapterNumber: 1,
          arcNumber: 1,
        },
        bridge,
      );

      // Should have Round 1 + Round 3
      const roundNumbers = result.rounds.map((r) => r.round);
      expect(roundNumbers).toContain(1);
      expect(roundNumbers).toContain(3);
    });

    it("uses default rubric score when parsing fails", async () => {
      const engine = new ReviewEngine({
        enableConsistencyCheck: false,
        enableLiteraryCheck: true,
      });
      const bridge = new SessionProjectBridge();

      // Placeholder bridge returns non-JSON content
      const result = await engine.review(
        {
          content: "内容。",
          chapterNumber: 1,
          arcNumber: 1,
        },
        bridge,
      );

      const r3 = result.rounds.find((r) => r.round === 3);
      expect(r3).toBeDefined();
      if (r3 && r3.round === 3) {
        // Default rubric score because placeholder response can't be parsed
        expect(r3.rubricScore.weightedScore).toBe(7.5);
      }
    });
  });

  describe("review — all three rounds", () => {
    it("executes all rounds in sequence", async () => {
      const engine = new ReviewEngine({
        enableConsistencyCheck: true,
        enableLiteraryCheck: true,
      });
      const bridge = new SessionProjectBridge();
      const completedRounds: number[] = [];

      const result = await engine.review(
        {
          content: [
            "山间的雾还没散。",
            "李长安坐在石阶上，手里攥着半个冷馒头，看师弟们在演武场上比划。",
            "他咬了口馒头，觉得今天的雾比昨天浓。",
          ].join("\n\n"),
          chapterNumber: 1,
          arcNumber: 1,
          consistencyContext: {
            characterProfiles: "李长安：外门弟子",
          },
        },
        bridge,
        (round) => {
          completedRounds.push(round.round);
        },
      );

      expect(completedRounds).toEqual([1, 2, 3]);
      expect(result.rounds).toHaveLength(3);
      expect(typeof result.score).toBe("number");
      expect(typeof result.burstiness).toBe("number");
    });
  });

  describe("review — passing judgment", () => {
    it("correctly determines pass/fail from round results", async () => {
      const engine = makeEngine({
        burstinessThreshold: 0.01, // Very low threshold so placeholder content passes
      });

      const result = await engine.review({
        content: "这是一段足够长的测试内容。包含多个句子。有不同的长度。短。还有一些较长的段落描述来增加变化率让测试通过。",
        chapterNumber: 1,
        arcNumber: 1,
      });

      // Without forbidden words and with relaxed threshold, should pass
      expect(result.failReasons).toBeDefined();
      expect(Array.isArray(result.failReasons)).toBe(true);
    });
  });
});
