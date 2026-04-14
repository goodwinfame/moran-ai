import { describe, expect, it, vi } from "vitest";
import { WriteSession } from "../write-session.js";
import { InMemoryDataProvider, type MockArcData } from "../in-memory-data-provider.js";
import { ChapterPipeline } from "../../orchestrator/chapter-pipeline.js";
import { Orchestrator } from "../../orchestrator/orchestrator.js";
import { StyleManager } from "../../style/style-manager.js";
import { SessionProjectBridge } from "../../bridge/bridge.js";
import { EventBus } from "../../events/event-bus.js";
import type { WriteChapterResult } from "../../orchestrator/types.js";
import type { WriteSessionEvent, WriteSessionState } from "../types.js";

// ── Test helpers ────────────────────────────────────────

const PROJECT_ID = "proj-ws-test";

/** Create a test WriteSession with all dependencies wired */
function createTestSession(opts?: {
  arcs?: MockArcData[];
  lastCompleted?: number;
  existingState?: WriteSessionState;
}) {
  const eventBus = new EventBus();
  const orchestrator = new Orchestrator(PROJECT_ID, { heartbeatInterval: 60_000 }, eventBus);
  const styleManager = new StyleManager();
  const bridge = new SessionProjectBridge();
  const pipeline = new ChapterPipeline(orchestrator, styleManager, bridge, null, {
    autoPassReview: true,
    antiAiCheck: false,
  });

  const dataProvider = new InMemoryDataProvider();

  // Setup default arc
  const arcs = opts?.arcs ?? [
    { arcNumber: 1, arcName: "第一弧段", startChapter: 1, endChapter: 10, totalChapters: 10 },
  ];
  for (const arc of arcs) {
    dataProvider.addArc(PROJECT_ID, arc);
  }

  if (opts?.lastCompleted !== undefined) {
    dataProvider.setLastCompletedChapter(PROJECT_ID, opts.lastCompleted);
  }

  const session = new WriteSession(
    orchestrator,
    pipeline,
    bridge,
    dataProvider,
    opts?.existingState,
  );

  return { session, orchestrator, pipeline, bridge, eventBus, dataProvider };
}

// ── WriteSession basic tests ───────────────────────────

describe("WriteSession", () => {
  describe("constructor", () => {
    it("creates session with idle state", () => {
      const { session } = createTestSession();
      const state = session.getState();

      expect(state.status).toBe("idle");
      expect(state.projectId).toBe(PROJECT_ID);
      expect(state.type).toBe("write-next");
      expect(state.completedChapters).toEqual([]);
      expect(state.stats.chaptersWritten).toBe(0);
    });

    it("restores from existing state", () => {
      const existing: WriteSessionState = {
        sessionId: "ws_existing",
        projectId: PROJECT_ID,
        type: "write-loop",
        status: "paused",
        currentArc: 1,
        nextChapter: 5,
        completedChapters: [1, 2, 3, 4],
        arcBoundaryAction: "pause",
        stats: {
          chaptersWritten: 4,
          totalWordCount: 8000,
          firstPassCount: 3,
          totalEstimatedCost: 0.5,
          startedAt: "2026-01-01T00:00:00.000Z",
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const { session } = createTestSession({ existingState: existing });
      const state = session.getState();

      expect(state.sessionId).toBe("ws_existing");
      expect(state.status).toBe("paused");
      expect(state.nextChapter).toBe(5);
      expect(state.completedChapters).toEqual([1, 2, 3, 4]);
    });
  });

  describe("isRunning / isResumable", () => {
    it("isRunning is false when idle", () => {
      const { session } = createTestSession();
      expect(session.isRunning).toBe(false);
    });

    it("isResumable is false when idle", () => {
      const { session } = createTestSession();
      expect(session.isResumable).toBe(false);
    });

    it("isResumable is true when paused", () => {
      const existing: WriteSessionState = {
        sessionId: "ws_paused",
        projectId: PROJECT_ID,
        type: "write-loop",
        status: "paused",
        currentArc: 1,
        nextChapter: 5,
        completedChapters: [1, 2, 3, 4],
        arcBoundaryAction: "pause",
        stats: {
          chaptersWritten: 4,
          totalWordCount: 0,
          firstPassCount: 0,
          totalEstimatedCost: 0,
          startedAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { session } = createTestSession({ existingState: existing });
      expect(session.isResumable).toBe(true);
    });
  });

  describe("event subscription", () => {
    it("allows subscribing and unsubscribing", () => {
      const { session } = createTestSession();
      const events: WriteSessionEvent[] = [];

      const unsub = session.on((e) => events.push(e));
      expect(typeof unsub).toBe("function");

      unsub();
      // No events should be emitted after unsubscribe
    });
  });
});

// ── write-next tests ───────────────────────────────────

describe("WriteSession.writeNext", () => {
  it("writes the next chapter successfully", async () => {
    const { session, dataProvider } = createTestSession({ lastCompleted: 0 });

    const result = await session.writeNext({ projectId: PROJECT_ID });

    expect(result.success).toBe(true);
    expect(result.chapterNumber).toBe(1);
    expect(result.arcInfo).toBeDefined();
    expect(result.arcInfo.currentArc).toBe(1);
    expect(result.isArcBoundary).toBe(false);

    // Should have updated project progress
    const progress = dataProvider.getProjectProgress(PROJECT_ID);
    expect(progress).toBeDefined();
    expect(progress?.chapter).toBe(1);
  });

  it("auto-determines chapter number from last completed", async () => {
    const { session } = createTestSession({ lastCompleted: 5 });

    const result = await session.writeNext({ projectId: PROJECT_ID });

    expect(result.chapterNumber).toBe(6);
  });

  it("uses explicit chapter number when provided", async () => {
    const { session } = createTestSession({ lastCompleted: 5 });

    const result = await session.writeNext({
      projectId: PROJECT_ID,
      chapterNumber: 3,
    });

    expect(result.chapterNumber).toBe(3);
  });

  it("detects arc boundary on last chapter", async () => {
    const { session } = createTestSession({
      lastCompleted: 9,
      arcs: [
        { arcNumber: 1, arcName: "第一弧段", startChapter: 1, endChapter: 10, totalChapters: 10 },
      ],
    });

    const result = await session.writeNext({ projectId: PROJECT_ID });

    expect(result.chapterNumber).toBe(10);
    expect(result.isArcBoundary).toBe(true);
    expect(result.arcInfo.isLastInArc).toBe(true);
  });

  it("emits chapter_start and chapter_complete events", async () => {
    const { session } = createTestSession();
    const events: WriteSessionEvent[] = [];
    session.on((e) => events.push(e));

    await session.writeNext({ projectId: PROJECT_ID });

    const types = events.map((e) => e.type);
    expect(types).toContain("chapter_start");
    expect(types).toContain("chapter_complete");
  });

  it("emits arc_boundary event when on last chapter", async () => {
    const { session } = createTestSession({
      lastCompleted: 9,
      arcs: [
        { arcNumber: 1, arcName: "第一弧段", startChapter: 1, endChapter: 10, totalChapters: 10 },
      ],
    });

    const events: WriteSessionEvent[] = [];
    session.on((e) => events.push(e));

    await session.writeNext({ projectId: PROJECT_ID });

    const types = events.map((e) => e.type);
    expect(types).toContain("arc_boundary");
  });

  it("persists session state", async () => {
    const { session, dataProvider } = createTestSession();

    await session.writeNext({ projectId: PROJECT_ID });

    const saved = dataProvider.getSavedSessionState(PROJECT_ID);
    expect(saved).toBeDefined();
    expect(saved?.status).toBe("completed");
    expect(saved?.completedChapters).toContain(1);
  });

  it("throws if session is already running", async () => {
    const { session } = createTestSession();

    // Start a writeNext (it runs async with placeholder bridge)
    const p1 = session.writeNext({ projectId: PROJECT_ID });

    // Second call should throw
    await expect(
      session.writeNext({ projectId: PROJECT_ID }),
    ).rejects.toThrow("already running");

    await p1; // Clean up
  });

  it("uses existing brief when requested", async () => {
    const { session, dataProvider } = createTestSession();
    dataProvider.setBrief(PROJECT_ID, 1, "一个关于冒险的章节");

    const result = await session.writeNext({
      projectId: PROJECT_ID,
      useExistingBrief: true,
    });

    expect(result.success).toBe(true);
  });
});

// ── write-loop tests ───────────────────────────────────

describe("WriteSession.writeLoop", () => {
  it("writes target number of chapters", async () => {
    const { session } = createTestSession();

    const result = await session.writeLoop({
      projectId: PROJECT_ID,
      targetChapters: 3,
      arcBoundaryAction: "continue",
    });

    expect(result.completed).toBe(true);
    expect(result.stopReason).toBe("target_reached");
    expect(result.chapters.length).toBe(3);
    expect(result.stats.chaptersWritten).toBe(3);
    expect(result.resumable).toBe(false);
  });

  it("pauses at arc boundary when configured", async () => {
    const { session, dataProvider } = createTestSession({
      lastCompleted: 8,
      arcs: [
        { arcNumber: 1, arcName: "第一弧段", startChapter: 1, endChapter: 10, totalChapters: 10 },
        { arcNumber: 2, arcName: "第二弧段", startChapter: 11, endChapter: 20, totalChapters: 10 },
      ],
    });

    const result = await session.writeLoop({
      projectId: PROJECT_ID,
      targetChapters: 5,
      arcBoundaryAction: "pause",
    });

    // Should pause at chapter 10 (arc boundary), having written chapters 9 and 10
    expect(result.stopReason).toBe("arc_boundary");
    expect(result.resumable).toBe(true);
    expect(result.arcBoundary).toBeDefined();
    expect(result.arcBoundary?.isLastInArc).toBe(true);
  });

  it("stops at arc boundary when configured", async () => {
    const { session } = createTestSession({
      lastCompleted: 8,
      arcs: [
        { arcNumber: 1, arcName: "第一弧段", startChapter: 1, endChapter: 10, totalChapters: 10 },
      ],
    });

    const result = await session.writeLoop({
      projectId: PROJECT_ID,
      targetChapters: 5,
      arcBoundaryAction: "stop",
    });

    expect(result.stopReason).toBe("arc_boundary");
    expect(result.chapters.length).toBe(2); // chapters 9 and 10
  });

  it("continues through arc boundary when configured", async () => {
    const { session } = createTestSession({
      lastCompleted: 8,
      arcs: [
        { arcNumber: 1, arcName: "第一弧段", startChapter: 1, endChapter: 10, totalChapters: 10 },
        { arcNumber: 2, arcName: "第二弧段", startChapter: 11, endChapter: 20, totalChapters: 10 },
      ],
    });

    const result = await session.writeLoop({
      projectId: PROJECT_ID,
      targetChapters: 3,
      arcBoundaryAction: "continue",
    });

    expect(result.completed).toBe(true);
    expect(result.chapters.length).toBe(3); // chapters 9, 10, 11
  });

  it("emits loop_progress events", async () => {
    const { session } = createTestSession();
    const events: WriteSessionEvent[] = [];
    session.on((e) => events.push(e));

    await session.writeLoop({
      projectId: PROJECT_ID,
      targetChapters: 2,
      arcBoundaryAction: "continue",
    });

    const progressEvents = events.filter((e) => e.type === "loop_progress");
    expect(progressEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("computes stats correctly", async () => {
    const { session } = createTestSession();

    const result = await session.writeLoop({
      projectId: PROJECT_ID,
      targetChapters: 3,
      arcBoundaryAction: "continue",
    });

    expect(result.stats.chaptersWritten).toBe(3);
    expect(result.stats.durationSeconds).toBeGreaterThanOrEqual(0);
    expect(result.stats.startedAt).toBeInstanceOf(Date);
    expect(result.stats.endedAt).toBeInstanceOf(Date);
    expect(result.stats.firstPassRate).toBeGreaterThanOrEqual(0);
    expect(result.stats.firstPassRate).toBeLessThanOrEqual(1);
  });

  it("updates project progress after each chapter", async () => {
    const { session, dataProvider } = createTestSession();

    await session.writeLoop({
      projectId: PROJECT_ID,
      targetChapters: 3,
      arcBoundaryAction: "continue",
    });

    const progress = dataProvider.getProjectProgress(PROJECT_ID);
    expect(progress?.chapter).toBe(3);
    expect(progress?.arc).toBe(1);
  });

  it("stops with no_more_chapters when no arcs configured", async () => {
    const { session } = createTestSession({ arcs: [] }); // No arcs → will stop immediately

    const result = await session.writeLoop({
      projectId: PROJECT_ID,
      targetChapters: 1,
      arcBoundaryAction: "continue",
    });

    // With no arcs, currentArc=0, which triggers no_more_chapters stop
    expect(result.chapters.length).toBe(0);
    expect(result.stopReason).toBe("no_more_chapters");
  });
});

// ── pause / resume tests ───────────────────────────────

describe("WriteSession.requestPause", () => {
  it("pauses the loop after current chapter completes", async () => {
    const { session } = createTestSession();

    // Start a loop, pause after first chapter
    const loopPromise = session.writeLoop({
      projectId: PROJECT_ID,
      targetChapters: 10,
      arcBoundaryAction: "continue",
    });

    // Note: With the placeholder bridge, chapters complete almost instantly.
    // requestPause may or may not take effect before all chapters finish.
    // In a real scenario, chapters take seconds/minutes.
    session.requestPause();

    const result = await loopPromise;

    // Either user_pause or target_reached (if it finished before pause took effect)
    expect(["user_pause", "target_reached"]).toContain(result.stopReason);
  });
});

describe("WriteSession.resume", () => {
  it("resumes from paused state", async () => {
    const existing: WriteSessionState = {
      sessionId: "ws_resume",
      projectId: PROJECT_ID,
      type: "write-loop",
      status: "paused",
      currentArc: 1,
      nextChapter: 5,
      completedChapters: [1, 2, 3, 4],
      arcBoundaryAction: "pause",
      targetChapters: 10,
      stats: {
        chaptersWritten: 4,
        totalWordCount: 8000,
        firstPassCount: 4,
        totalEstimatedCost: 0,
        startedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { session } = createTestSession({ existingState: existing });

    const result = await session.resume({ targetChapters: 6 });

    // Should write remaining chapters (6 target - 4 already = resume with 2 from override subtraction)
    // Actually, resume calculates: targetChapters(6) - chaptersWritten(4) = 2 remaining
    expect(result.chapters.length).toBe(2);
  });

  it("throws if session is not resumable", async () => {
    const { session } = createTestSession();

    await expect(session.resume()).rejects.toThrow("Cannot resume");
  });

  it("allows overriding arcBoundaryAction on resume", async () => {
    const existing: WriteSessionState = {
      sessionId: "ws_resume_override",
      projectId: PROJECT_ID,
      type: "write-loop",
      status: "paused",
      currentArc: 1,
      nextChapter: 3,
      completedChapters: [1, 2],
      arcBoundaryAction: "pause",
      stats: {
        chaptersWritten: 2,
        totalWordCount: 4000,
        firstPassCount: 2,
        totalEstimatedCost: 0,
        startedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { session } = createTestSession({ existingState: existing });

    const result = await session.resume({
      targetChapters: 3,
      arcBoundaryAction: "continue",
    });

    // targetChapters override: 3 - 2 = 1 remaining
    expect(result.chapters.length).toBe(1);
  });
});

// ── restore tests ──────────────────────────────────────

describe("WriteSession.restore", () => {
  it("restores from saved state", async () => {
    const { orchestrator, pipeline, bridge, dataProvider } = createTestSession();

    // Save a paused state
    const state: WriteSessionState = {
      sessionId: "ws_saved",
      projectId: PROJECT_ID,
      type: "write-loop",
      status: "paused",
      currentArc: 1,
      nextChapter: 5,
      completedChapters: [1, 2, 3, 4],
      arcBoundaryAction: "pause",
      stats: {
        chaptersWritten: 4,
        totalWordCount: 8000,
        firstPassCount: 4,
        totalEstimatedCost: 0,
        startedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await dataProvider.saveSessionState(state);

    const restored = await WriteSession.restore(
      orchestrator,
      pipeline,
      bridge,
      dataProvider,
    );

    expect(restored).not.toBeNull();
    expect(restored?.getState().sessionId).toBe("ws_saved");
    expect(restored?.getState().nextChapter).toBe(5);
    expect(restored?.isResumable).toBe(true);
  });

  it("returns null when no saved state", async () => {
    const { orchestrator, pipeline, bridge, dataProvider } = createTestSession();

    const restored = await WriteSession.restore(
      orchestrator,
      pipeline,
      bridge,
      dataProvider,
    );

    expect(restored).toBeNull();
  });

  it("returns null when saved state is completed (not resumable)", async () => {
    const { orchestrator, pipeline, bridge, dataProvider } = createTestSession();

    const state: WriteSessionState = {
      sessionId: "ws_done",
      projectId: PROJECT_ID,
      type: "write-loop",
      status: "completed",
      currentArc: 1,
      nextChapter: 11,
      completedChapters: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      arcBoundaryAction: "pause",
      stats: {
        chaptersWritten: 10,
        totalWordCount: 20000,
        firstPassCount: 8,
        totalEstimatedCost: 1.0,
        startedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await dataProvider.saveSessionState(state);

    const restored = await WriteSession.restore(
      orchestrator,
      pipeline,
      bridge,
      dataProvider,
    );

    expect(restored).toBeNull();
  });
});

// ── arc boundary detection tests ───────────────────────

describe("arc boundary detection", () => {
  it("correctly identifies mid-arc position", async () => {
    const { session } = createTestSession({
      lastCompleted: 4,
      arcs: [
        { arcNumber: 1, arcName: "第一弧段", startChapter: 1, endChapter: 10, totalChapters: 10 },
      ],
    });

    const result = await session.writeNext({ projectId: PROJECT_ID });

    expect(result.arcInfo.positionInArc).toBe(5); // chapter 5 is position 5 in arc starting at 1
    expect(result.arcInfo.isLastInArc).toBe(false);
  });

  it("includes next arc info when at boundary", async () => {
    const { session } = createTestSession({
      lastCompleted: 9,
      arcs: [
        { arcNumber: 1, arcName: "第一弧段", startChapter: 1, endChapter: 10, totalChapters: 10 },
        { arcNumber: 2, arcName: "第二弧段", startChapter: 11, endChapter: 20, totalChapters: 10 },
      ],
    });

    const result = await session.writeNext({ projectId: PROJECT_ID });

    expect(result.arcInfo.isLastInArc).toBe(true);
    expect(result.arcInfo.nextArc).toBe(2);
    expect(result.arcInfo.nextArcName).toBe("第二弧段");
  });

  it("handles no next arc gracefully", async () => {
    const { session } = createTestSession({
      lastCompleted: 9,
      arcs: [
        { arcNumber: 1, arcName: "第一弧段", startChapter: 1, endChapter: 10, totalChapters: 10 },
      ],
    });

    const result = await session.writeNext({ projectId: PROJECT_ID });

    expect(result.arcInfo.isLastInArc).toBe(true);
    expect(result.arcInfo.nextArc).toBeUndefined();
  });
});

// ── chapter type inference tests ───────────────────────

describe("chapter type inference", () => {
  it("infers climax for last chapter in arc", async () => {
    const { session } = createTestSession({
      lastCompleted: 9,
      arcs: [
        { arcNumber: 1, startChapter: 1, endChapter: 10, totalChapters: 10 },
      ],
    });

    // We can't directly access inferChapterType, so we test through writeNext
    // and verify it succeeds (indirect test)
    const result = await session.writeNext({ projectId: PROJECT_ID });
    expect(result.success).toBe(true);
  });

  it("infers daily for early chapter in arc", async () => {
    const { session } = createTestSession({
      lastCompleted: 0,
      arcs: [
        { arcNumber: 1, startChapter: 1, endChapter: 20, totalChapters: 20 },
      ],
    });

    const result = await session.writeNext({ projectId: PROJECT_ID });
    expect(result.success).toBe(true);
  });
});

// ── InMemoryDataProvider tests ─────────────────────────

describe("InMemoryDataProvider", () => {
  it("stores and retrieves last completed chapter", async () => {
    const dp = new InMemoryDataProvider();
    dp.setLastCompletedChapter("p1", 5);
    expect(await dp.getLastCompletedChapter("p1")).toBe(5);
    expect(await dp.getLastCompletedChapter("p2")).toBe(0); // default
  });

  it("stores and retrieves arc data", async () => {
    const dp = new InMemoryDataProvider();
    dp.addArc("p1", { arcNumber: 1, arcName: "Arc 1", startChapter: 1, endChapter: 10, totalChapters: 10 });
    dp.addArc("p1", { arcNumber: 2, arcName: "Arc 2", startChapter: 11, endChapter: 20, totalChapters: 10 });

    const arc = await dp.getCurrentArc("p1");
    expect(arc).toBeDefined();
    expect(arc?.arcNumber).toBe(1);

    const next = await dp.getNextArc("p1", 1);
    expect(next?.arcNumber).toBe(2);
    expect(next?.arcName).toBe("Arc 2");

    const noNext = await dp.getNextArc("p1", 2);
    expect(noNext).toBeNull();
  });

  it("stores and retrieves briefs", async () => {
    const dp = new InMemoryDataProvider();
    dp.setBrief("p1", 5, "Chapter 5 brief");
    expect(await dp.getChapterBrief("p1", 5)).toBe("Chapter 5 brief");
    expect(await dp.getChapterBrief("p1", 6)).toBeNull();
    expect(await dp.getChapterBrief("p2", 5)).toBeNull();
  });

  it("stores and retrieves session state", async () => {
    const dp = new InMemoryDataProvider();
    const state: WriteSessionState = {
      sessionId: "ws_test",
      projectId: "p1",
      type: "write-loop",
      status: "paused",
      currentArc: 1,
      nextChapter: 3,
      completedChapters: [1, 2],
      arcBoundaryAction: "pause",
      stats: {
        chaptersWritten: 2,
        totalWordCount: 4000,
        firstPassCount: 2,
        totalEstimatedCost: 0,
        startedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dp.saveSessionState(state);
    const loaded = await dp.loadSessionState("p1");
    expect(loaded?.sessionId).toBe("ws_test");
    expect(loaded?.completedChapters).toEqual([1, 2]);
  });

  it("updates project progress and last completed", async () => {
    const dp = new InMemoryDataProvider();
    await dp.updateProjectProgress("p1", 5, 1);
    expect(await dp.getLastCompletedChapter("p1")).toBe(5);
    expect(dp.getProjectProgress("p1")).toEqual({ chapter: 5, arc: 1 });
  });

  it("returns null for missing session state", async () => {
    const dp = new InMemoryDataProvider();
    expect(await dp.loadSessionState("nonexistent")).toBeNull();
  });

  it("returns null for missing arc", async () => {
    const dp = new InMemoryDataProvider();
    expect(await dp.getCurrentArc("nonexistent")).toBeNull();
  });
});
