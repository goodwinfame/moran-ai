/**
 * Tests for Panel Event Router (T7)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  routeToolResultToTab,
  handleAutoSwitch,
  TOOL_TAB_MAP,
  type TabId,
} from "@/lib/panel-event-router";

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("routeToolResultToTab()", () => {
  it("maps brainstorm tools to 'brainstorm'", () => {
    expect(routeToolResultToTab("brainstorm_create")).toBe("brainstorm");
    expect(routeToolResultToTab("brainstorm_update")).toBe("brainstorm");
    expect(routeToolResultToTab("brainstorm_patch")).toBe("brainstorm");
  });

  it("maps world tools to 'world'", () => {
    expect(routeToolResultToTab("world_create")).toBe("world");
    expect(routeToolResultToTab("world_update")).toBe("world");
    expect(routeToolResultToTab("world_delete")).toBe("world");
    expect(routeToolResultToTab("world_patch")).toBe("world");
  });

  it("maps character tools to 'character'", () => {
    const tools = [
      "character_create",
      "character_update",
      "character_delete",
      "character_patch",
      "character_state_create",
      "relationship_create",
      "relationship_update",
    ];
    for (const t of tools) {
      expect(routeToolResultToTab(t), t).toBe("character");
    }
  });

  it("maps outline tools to 'outline'", () => {
    expect(routeToolResultToTab("outline_create")).toBe("outline");
    expect(routeToolResultToTab("outline_update")).toBe("outline");
    expect(routeToolResultToTab("outline_patch")).toBe("outline");
  });

  it("maps chapter/style/summary tools to 'chapter'", () => {
    const tools = [
      "chapter_create",
      "chapter_update",
      "chapter_archive",
      "chapter_patch",
      "style_create",
      "style_update",
      "summary_create",
    ];
    for (const t of tools) {
      expect(routeToolResultToTab(t), t).toBe("chapter");
    }
  });

  it("maps review_execute to 'review'", () => {
    expect(routeToolResultToTab("review_execute")).toBe("review");
  });

  it("maps analysis_execute to 'analysis'", () => {
    expect(routeToolResultToTab("analysis_execute")).toBe("analysis");
  });

  it("maps knowledge/lesson/thread/timeline tools to 'knowledge'", () => {
    const tools = [
      "knowledge_create",
      "knowledge_update",
      "knowledge_delete",
      "knowledge_patch",
      "lesson_create",
      "lesson_update",
      "thread_create",
      "thread_update",
      "timeline_create",
    ];
    for (const t of tools) {
      expect(routeToolResultToTab(t), t).toBe("knowledge");
    }
  });

  it("returns null for unknown tools", () => {
    expect(routeToolResultToTab("unknown_tool")).toBeNull();
    expect(routeToolResultToTab("")).toBeNull();
    expect(routeToolResultToTab("read_something")).toBeNull();
  });

  it("covers all 8 tab types in the map", () => {
    const tabIds = new Set(Object.values(TOOL_TAB_MAP));
    const expected: TabId[] = [
      "brainstorm",
      "world",
      "character",
      "outline",
      "chapter",
      "review",
      "analysis",
      "knowledge",
    ];
    for (const tab of expected) {
      expect(tabIds, `tab "${tab}" should be in TOOL_TAB_MAP`).toContain(tab);
    }
  });
});

describe("handleAutoSwitch()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'switch' when user last acted more than 10s ago", () => {
    const longAgo = Date.now() - 15_000;
    const result = handleAutoSwitch("character", longAgo);
    expect(result.action).toBe("switch");
    expect(result.tab).toBe("character");
  });

  it("returns 'badge' when user acted less than 10s ago", () => {
    const recentTime = Date.now() - 5_000;
    const result = handleAutoSwitch("outline", recentTime);
    expect(result.action).toBe("badge");
    expect(result.tab).toBe("outline");
  });

  it("returns 'badge' when user acted exactly 9999ms ago (within 10s boundary)", () => {
    const justUnder10s = Date.now() - 9_999;
    const result = handleAutoSwitch("chapter", justUnder10s);
    expect(result.action).toBe("badge");
  });

  it("returns 'switch' when elapsed is exactly 10000ms", () => {
    const exactly10s = Date.now() - 10_000;
    const result = handleAutoSwitch("review", exactly10s);
    expect(result.action).toBe("switch");
  });

  it("returns 'switch' when lastUserActionTime is very old (e.g. 0)", () => {
    const result = handleAutoSwitch("brainstorm", 0);
    expect(result.action).toBe("switch");
  });

  it("returns the correct tab in both action branches", () => {
    const recent = Date.now() - 1_000;
    const old = Date.now() - 20_000;

    expect(handleAutoSwitch("knowledge", recent).tab).toBe("knowledge");
    expect(handleAutoSwitch("analysis", old).tab).toBe("analysis");
  });
});
