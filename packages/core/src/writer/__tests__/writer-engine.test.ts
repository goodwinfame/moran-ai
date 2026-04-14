import { describe, expect, it, vi } from "vitest";
import { WriterEngine, writerResultToEvents } from "../writer-engine.js";
import { StyleManager } from "../../style/style-manager.js";
import { SessionProjectBridge } from "../../bridge/bridge.js";
import type { WriterResult, WritingChunk } from "../../style/types.js";

describe("WriterEngine", () => {
  const makeEngine = (opts?: { antiAiCheck?: boolean; streaming?: boolean }) => {
    const styleManager = new StyleManager();
    return new WriterEngine(styleManager, opts);
  };

  describe("constructor", () => {
    it("creates engine with default config", () => {
      const engine = makeEngine();
      expect(engine).toBeDefined();
      expect(engine.getStyleManager()).toBeInstanceOf(StyleManager);
    });

    it("accepts custom config", () => {
      const engine = makeEngine({ antiAiCheck: false, streaming: false });
      expect(engine).toBeDefined();
    });
  });

  describe("prepareContext", () => {
    it("builds WriterContext from params", () => {
      const engine = makeEngine();
      const ctx = engine.prepareContext({
        projectId: "proj-1",
        chapterNumber: 3,
        arcNumber: 1,
        chapterType: "action",
        styleId: "云墨",
        brief: "第三章简述",
      });

      expect(ctx.projectId).toBe("proj-1");
      expect(ctx.chapterNumber).toBe(3);
      expect(ctx.chapterType).toBe("action");
      expect(ctx.style.displayName).toBe("执笔·云墨");
      expect(ctx.temperature).toBeGreaterThan(0.7);
      expect(ctx.brief).toBe("第三章简述");
    });

    it("uses default assembled context when not provided", () => {
      const engine = makeEngine();
      const ctx = engine.prepareContext({
        projectId: "p",
        chapterNumber: 1,
        arcNumber: 1,
        chapterType: "normal",
        styleId: "云墨",
      });
      expect(ctx.assembledContext).toBe("");
      expect(ctx.moduleContents).toEqual({});
    });

    it("uses different temperature for different chapter types", () => {
      const engine = makeEngine();
      const daily = engine.prepareContext({
        projectId: "p", chapterNumber: 1, arcNumber: 1, chapterType: "daily", styleId: "云墨",
      });
      const climax = engine.prepareContext({
        projectId: "p", chapterNumber: 1, arcNumber: 1, chapterType: "climax", styleId: "云墨",
      });
      expect(climax.temperature).toBeGreaterThan(daily.temperature);
    });
  });

  describe("buildSystemPrompt", () => {
    it("includes role definition", () => {
      const engine = makeEngine();
      const ctx = engine.prepareContext({
        projectId: "p", chapterNumber: 1, arcNumber: 1, chapterType: "normal", styleId: "云墨",
      });

      const prompt = engine.buildSystemPrompt(ctx);
      expect(prompt).toContain("你是执笔");
      expect(prompt).toContain("墨染唯一的写手");
    });

    it("includes core principles", () => {
      const engine = makeEngine();
      const ctx = engine.prepareContext({
        projectId: "p", chapterNumber: 1, arcNumber: 1, chapterType: "normal", styleId: "云墨",
      });

      const prompt = engine.buildSystemPrompt(ctx);
      expect(prompt).toContain("感官先行");
      expect(prompt).toContain("句式多样性");
    });

    it("includes style context", () => {
      const engine = makeEngine();
      const ctx = engine.prepareContext({
        projectId: "p", chapterNumber: 1, arcNumber: 1, chapterType: "normal", styleId: "云墨",
      });

      const prompt = engine.buildSystemPrompt(ctx);
      expect(prompt).toContain("执笔·云墨");
    });

    it("includes anti-AI reminder when enabled", () => {
      const engine = makeEngine({ antiAiCheck: true });
      const ctx = engine.prepareContext({
        projectId: "p", chapterNumber: 1, arcNumber: 1, chapterType: "normal", styleId: "云墨",
      });

      const prompt = engine.buildSystemPrompt(ctx);
      expect(prompt).toContain("Anti-AI 自检提醒");
    });

    it("excludes anti-AI reminder when disabled", () => {
      const engine = makeEngine({ antiAiCheck: false });
      const ctx = engine.prepareContext({
        projectId: "p", chapterNumber: 1, arcNumber: 1, chapterType: "normal", styleId: "云墨",
      });

      const prompt = engine.buildSystemPrompt(ctx);
      expect(prompt).not.toContain("Anti-AI 自检提醒");
    });

    it("includes module contents when present", () => {
      const engine = makeEngine();
      const ctx = engine.prepareContext({
        projectId: "p", chapterNumber: 1, arcNumber: 1, chapterType: "action", styleId: "云墨",
        moduleContents: { "战斗描写": "战斗模块内容..." },
      });

      const prompt = engine.buildSystemPrompt(ctx);
      expect(prompt).toContain("当前加载的专项模块");
      expect(prompt).toContain("战斗描写");
    });
  });

  describe("buildUserMessage", () => {
    it("includes chapter number", () => {
      const engine = makeEngine();
      const ctx = engine.prepareContext({
        projectId: "p", chapterNumber: 7, arcNumber: 2, chapterType: "normal", styleId: "云墨",
      });

      const msg = engine.buildUserMessage(ctx);
      expect(msg).toContain("第 7 章");
    });

    it("includes brief when provided", () => {
      const engine = makeEngine();
      const ctx = engine.prepareContext({
        projectId: "p", chapterNumber: 1, arcNumber: 1, chapterType: "normal", styleId: "云墨",
        brief: "主角初入江湖",
      });

      const msg = engine.buildUserMessage(ctx);
      expect(msg).toContain("章节 Brief");
      expect(msg).toContain("主角初入江湖");
    });

    it("includes requirements section", () => {
      const engine = makeEngine();
      const ctx = engine.prepareContext({
        projectId: "p", chapterNumber: 1, arcNumber: 1, chapterType: "normal", styleId: "云墨",
      });

      const msg = engine.buildUserMessage(ctx);
      expect(msg).toContain("内容创作最重要");
      expect(msg).toContain("有灵性的文章");
    });
  });

  describe("write", () => {
    it("calls bridge.invokeAgent and returns result", async () => {
      const engine = makeEngine({ antiAiCheck: false });
      const bridge = new SessionProjectBridge();

      const ctx = engine.prepareContext({
        projectId: "p", chapterNumber: 1, arcNumber: 1, chapterType: "normal", styleId: "云墨",
      });

      const result = await engine.write(ctx, bridge);

      expect(result.content).toBeTruthy();
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.antiAiCheck.passed).toBe(true);
      expect(result.usage).toBeDefined();
    });

    it("calls onChunk callback", async () => {
      const engine = makeEngine({ antiAiCheck: false });
      const bridge = new SessionProjectBridge();

      const ctx = engine.prepareContext({
        projectId: "p", chapterNumber: 1, arcNumber: 1, chapterType: "normal", styleId: "云墨",
      });

      const chunks: WritingChunk[] = [];
      await engine.write(ctx, bridge, (chunk) => chunks.push(chunk));

      expect(chunks.length).toBeGreaterThan(0);
      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk?.cumulativeWordCount).toBeGreaterThan(0);
    });

    it("runs anti-AI check when enabled", async () => {
      const engine = makeEngine({ antiAiCheck: true });
      const bridge = new SessionProjectBridge();

      const ctx = engine.prepareContext({
        projectId: "p", chapterNumber: 1, arcNumber: 1, chapterType: "normal", styleId: "云墨",
      });

      const result = await engine.write(ctx, bridge);
      expect(result.antiAiCheck).toBeDefined();
      expect(typeof result.antiAiCheck.burstiness).toBe("number");
    });
  });
});

describe("writerResultToEvents", () => {
  it("produces writing + done events", () => {
    const result: WriterResult = {
      content: "章节内容",
      wordCount: 4,
      antiAiCheck: { passed: true, burstiness: 0.5, issues: [] },
      usage: { inputTokens: 100, outputTokens: 200 },
    };

    const events = writerResultToEvents(result, 1);
    expect(events).toHaveLength(2);

    expect(events[0]?.type).toBe("writing");
    expect(events[1]?.type).toBe("done");
  });

  it("includes anti-AI data in done event", () => {
    const result: WriterResult = {
      content: "内容",
      wordCount: 2,
      antiAiCheck: { passed: false, burstiness: 0.2, issues: [{ type: "low_burstiness", description: "test" }] },
      usage: { inputTokens: 50, outputTokens: 100 },
    };

    const events = writerResultToEvents(result, 5);
    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent).toBeDefined();
    if (doneEvent?.type === "done") {
      expect(doneEvent.data.chapterNumber).toBe(5);
      expect(doneEvent.data.antiAiCheck?.passed).toBe(false);
      expect(doneEvent.data.antiAiCheck?.issueCount).toBe(1);
    }
  });
});
