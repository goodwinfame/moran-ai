/**
 * Tests for panel-store (Zustand store for info panel)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock idb-keyval before importing the store
vi.mock("idb-keyval", () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
}));

import { usePanelStore } from "@/stores/panel-store";
import type { TabId, BadgeType } from "@/stores/panel-store";

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetStore() {
  usePanelStore.setState({
    activeTab: "brainstorm",
    visibleTabs: [],
    badges: {},
    lastUserActionTime: 0,
    brainstorm: null,
    world: null,
    characters: null,
    outline: null,
    foreshadows: null,
    timeline: null,
    chapters: null,
    reviews: null,
    analysis: null,
    externalAnalysis: null,
    knowledge: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

afterEach(() => {
  resetStore();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("usePanelStore", () => {
  describe("initial state", () => {
    it("starts with brainstorm as active tab", () => {
      expect(usePanelStore.getState().activeTab).toBe("brainstorm");
    });

    it("starts with no visible tabs", () => {
      expect(usePanelStore.getState().visibleTabs).toEqual([]);
    });

    it("starts with no badges", () => {
      expect(usePanelStore.getState().badges).toEqual({});
    });

    it("starts with all data as null", () => {
      const s = usePanelStore.getState();
      expect(s.brainstorm).toBeNull();
      expect(s.world).toBeNull();
      expect(s.characters).toBeNull();
      expect(s.outline).toBeNull();
      expect(s.chapters).toBeNull();
      expect(s.reviews).toBeNull();
      expect(s.analysis).toBeNull();
      expect(s.knowledge).toBeNull();
    });
  });

  describe("setActiveTab()", () => {
    it("sets the active tab", () => {
      usePanelStore.getState().setActiveTab("world");
      expect(usePanelStore.getState().activeTab).toBe("world");
    });
  });

  describe("addVisibleTab()", () => {
    it("adds a tab to visibleTabs", () => {
      usePanelStore.getState().addVisibleTab("world");
      expect(usePanelStore.getState().visibleTabs).toContain("world");
    });

    it("does not add duplicate tabs", () => {
      usePanelStore.getState().addVisibleTab("world");
      usePanelStore.getState().addVisibleTab("world");
      expect(usePanelStore.getState().visibleTabs.filter((t) => t === "world")).toHaveLength(1);
    });

    it("preserves fixed tab order", () => {
      usePanelStore.getState().addVisibleTab("knowledge");
      usePanelStore.getState().addVisibleTab("brainstorm");
      usePanelStore.getState().addVisibleTab("chapter");
      const tabs = usePanelStore.getState().visibleTabs;
      expect(tabs.indexOf("brainstorm")).toBeLessThan(tabs.indexOf("chapter"));
      expect(tabs.indexOf("chapter")).toBeLessThan(tabs.indexOf("knowledge"));
    });

    it("sets first visible tab as active when no tab was active", () => {
      usePanelStore.getState().addVisibleTab("world");
      expect(usePanelStore.getState().activeTab).toBe("world");
    });

    it("does not change active tab when tabs already exist", () => {
      usePanelStore.getState().addVisibleTab("world");
      usePanelStore.getState().addVisibleTab("character");
      expect(usePanelStore.getState().activeTab).toBe("world");
    });
  });

  describe("handleAutoSwitch()", () => {
    it("switches tab when last user action was > 10s ago", () => {
      usePanelStore.setState({ lastUserActionTime: Date.now() - 15_000 });
      usePanelStore.getState().handleAutoSwitch("world");
      expect(usePanelStore.getState().activeTab).toBe("world");
    });

    it("adds dot badge instead of switching when user acted < 10s ago", () => {
      usePanelStore.setState({ lastUserActionTime: Date.now() - 5_000 });
      usePanelStore.getState().handleAutoSwitch("world");
      expect(usePanelStore.getState().activeTab).toBe("brainstorm");
      expect(usePanelStore.getState().badges["world"]).toEqual({ type: "dot" });
    });
  });

  describe("addBadge()", () => {
    it("adds a dot badge", () => {
      usePanelStore.getState().addBadge("world", { type: "dot" });
      expect(usePanelStore.getState().badges["world"]).toEqual({ type: "dot" });
    });

    it("adds a live badge", () => {
      usePanelStore.getState().addBadge("chapter", { type: "live" });
      expect(usePanelStore.getState().badges["chapter"]).toEqual({ type: "live" });
    });

    it("increments count badge when existing count badge present", () => {
      usePanelStore.getState().addBadge("knowledge", { type: "count", value: 3 });
      usePanelStore.getState().addBadge("knowledge", { type: "count", value: 2 });
      const badge = usePanelStore.getState().badges["knowledge"] as Extract<BadgeType, { type: "count" }>;
      expect(badge.value).toBe(5);
    });

    it("replaces non-count badge with count badge", () => {
      usePanelStore.getState().addBadge("world", { type: "dot" });
      usePanelStore.getState().addBadge("world", { type: "count", value: 1 });
      expect(usePanelStore.getState().badges["world"]).toEqual({ type: "count", value: 1 });
    });
  });

  describe("clearBadge()", () => {
    it("removes a badge", () => {
      usePanelStore.getState().addBadge("world", { type: "dot" });
      usePanelStore.getState().clearBadge("world");
      expect(usePanelStore.getState().badges["world"]).toBeUndefined();
    });

    it("is safe to call when no badge exists", () => {
      expect(() => usePanelStore.getState().clearBadge("world")).not.toThrow();
    });
  });

  describe("setLastUserAction()", () => {
    it("updates lastUserActionTime", () => {
      const now = Date.now();
      usePanelStore.getState().setLastUserAction(now);
      expect(usePanelStore.getState().lastUserActionTime).toBe(now);
    });
  });

  describe("updateBrainstorm()", () => {
    it("initialises brainstorm data from null", () => {
      usePanelStore.getState().updateBrainstorm({ diverge: [{ id: "1", title: "idea", starred: false }] });
      expect(usePanelStore.getState().brainstorm?.diverge).toHaveLength(1);
    });

    it("merges patch into existing data", () => {
      usePanelStore.getState().updateBrainstorm({ diverge: [] });
      usePanelStore.getState().updateBrainstorm({ converge: { selectedDirections: [], genre: "玄幻", coreConflict: "", targetAudience: "" } });
      expect(usePanelStore.getState().brainstorm?.converge?.genre).toBe("玄幻");
      expect(usePanelStore.getState().brainstorm?.diverge).toEqual([]);
    });
  });

  describe("updateChapter()", () => {
    it("appends to streamingContent when appendContent is provided", () => {
      usePanelStore.getState().updateChapter({ appendContent: "hello " });
      usePanelStore.getState().updateChapter({ appendContent: "world" });
      expect(usePanelStore.getState().chapters?.streamingContent).toBe("hello world");
    });

    it("replaces streamingContent when content field is set directly", () => {
      usePanelStore.getState().updateChapter({ streamingContent: "replaced" });
      expect(usePanelStore.getState().chapters?.streamingContent).toBe("replaced");
    });
  });

  describe("initFromCache()", () => {
    it("loads cached state from idb-keyval", async () => {
      const { get } = await import("idb-keyval");
      const mockGet = get as ReturnType<typeof vi.fn>;
      mockGet.mockResolvedValueOnce({
        activeTab: "world" as TabId,
        visibleTabs: ["brainstorm", "world"] as TabId[],
        brainstorm: null,
        world: null,
        characters: null,
        outline: null,
        foreshadows: null,
        timeline: null,
        chapters: null,
        reviews: null,
        analysis: null,
        externalAnalysis: null,
        knowledge: null,
      });

      await usePanelStore.getState().initFromCache("proj-1");
      expect(usePanelStore.getState().activeTab).toBe("world");
      expect(usePanelStore.getState().visibleTabs).toEqual(["brainstorm", "world"]);
    });

    it("does not crash when cache is empty", async () => {
      const { get } = await import("idb-keyval");
      (get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
      await expect(usePanelStore.getState().initFromCache("proj-empty")).resolves.not.toThrow();
    });
  });
});
