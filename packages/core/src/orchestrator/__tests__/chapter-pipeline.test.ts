import { describe, expect, it, vi } from "vitest";
import { ChapterPipeline } from "../chapter-pipeline.js";
import { Orchestrator } from "../orchestrator.js";
import { StyleManager } from "../../style/style-manager.js";
import { SessionProjectBridge } from "../../bridge/bridge.js";
import { EventBus } from "../../events/event-bus.js";
import type { SSEEvent } from "../../events/types.js";

describe("ChapterPipeline", () => {
  const makePipeline = (opts?: { autoPassReview?: boolean; antiAiCheck?: boolean }) => {
    const eventBus = new EventBus();
    const orchestrator = new Orchestrator("proj-test", { heartbeatInterval: 60_000 }, eventBus);
    const styleManager = new StyleManager();
    const bridge = new SessionProjectBridge();

    const pipeline = new ChapterPipeline(orchestrator, styleManager, bridge, {
      autoPassReview: opts?.autoPassReview ?? true,
      antiAiCheck: opts?.antiAiCheck ?? false, // Disable for placeholder content
    });

    return { pipeline, orchestrator, eventBus };
  };

  describe("writeChapter — happy path", () => {
    it("completes full pipeline and returns success", async () => {
      const { pipeline, orchestrator } = makePipeline();

      const result = await pipeline.writeChapter({
        chapterNumber: 1,
        arcNumber: 1,
        chapterType: "normal",
        styleId: "云墨",
      });

      expect(result.success).toBe(true);
      expect(result.chapterNumber).toBe(1);
      expect(result.content).toBeTruthy();
      expect(result.spiralInterrupted).toBe(false);
      expect(result.reviewRounds).toBeGreaterThanOrEqual(1);

      // Orchestrator should be back to idle
      expect(orchestrator.getState().phase).toBe("idle");
    });

    it("emits SSE events during pipeline", async () => {
      const { pipeline, eventBus } = makePipeline();

      const events: SSEEvent[] = [];
      eventBus.subscribe("proj-test", (event) => events.push(event));

      await pipeline.writeChapter({
        chapterNumber: 1,
        arcNumber: 1,
        chapterType: "normal",
        styleId: "云墨",
      });

      const types = events.map((e) => e.type);
      // Should have at least: writing, reviewing, review, archiving, done
      expect(types).toContain("writing");
      expect(types).toContain("reviewing");
      expect(types).toContain("review");
      expect(types).toContain("archiving");
      expect(types).toContain("done");
    });

    it("tracks cost", async () => {
      const { pipeline } = makePipeline();

      const result = await pipeline.writeChapter({
        chapterNumber: 3,
        arcNumber: 1,
        chapterType: "daily",
        styleId: "云墨",
      });

      expect(result.cost).toBeDefined();
      expect(result.cost.chapterNumber).toBe(3);
    });
  });

  describe("writeChapter — with brief and context", () => {
    it("passes brief and assembled context to writer", async () => {
      const { pipeline } = makePipeline();

      const result = await pipeline.writeChapter({
        chapterNumber: 2,
        arcNumber: 1,
        chapterType: "emotional",
        styleId: "云墨",
        brief: "主角失去了重要的人",
        assembledContext: "前情提要...",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("writeChapter — different styles", () => {
    it("works with 剑心 style", async () => {
      const { pipeline } = makePipeline();

      const result = await pipeline.writeChapter({
        chapterNumber: 1,
        arcNumber: 1,
        chapterType: "action",
        styleId: "剑心",
      });

      expect(result.success).toBe(true);
    });

    it("falls back to default for unknown style", async () => {
      const { pipeline } = makePipeline();

      const result = await pipeline.writeChapter({
        chapterNumber: 1,
        arcNumber: 1,
        chapterType: "normal",
        styleId: "不存在",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("writeChapter — error handling", () => {
    it("returns error result on orchestrator conflict", async () => {
      const { pipeline, orchestrator } = makePipeline();

      // Start writing to put orchestrator in non-idle state
      orchestrator.startWriting(1, 1);

      const result = await pipeline.writeChapter({
        chapterNumber: 2,
        arcNumber: 1,
        chapterType: "normal",
        styleId: "云墨",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe("getWriterEngine", () => {
    it("returns the WriterEngine instance", () => {
      const { pipeline } = makePipeline();
      const engine = pipeline.getWriterEngine();
      expect(engine).toBeDefined();
    });
  });
});
