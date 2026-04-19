/**
 * Tests for panel-store (Zustand store for info panel)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock idb-keyval before importing the store
vi.mock("idb-keyval", () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
}));

// Mock @/lib/api
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
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

  describe("fetchInitialData()", () => {
    async function getMockApiGet() {
      const { api } = await import("@/lib/api");
      return api.get as ReturnType<typeof vi.fn>;
    }

    function setupAllSucceed(mockGet: ReturnType<typeof vi.fn>) {
      mockGet
        .mockResolvedValueOnce({ ok: true, data: [] })  // brainstorms
        .mockResolvedValueOnce({ ok: true, data: [] })  // world-settings
        .mockResolvedValueOnce({ ok: true, data: [] })  // characters
        .mockResolvedValueOnce({ ok: true, data: { outline: null, arcs: [] } })  // outline
        .mockResolvedValueOnce({ ok: true, data: [] }); // chapters
    }

    it("resolves without throwing when all API calls succeed", async () => {
      const mockGet = await getMockApiGet();
      setupAllSucceed(mockGet);
      await expect(
        usePanelStore.getState().fetchInitialData("proj-1"),
      ).resolves.not.toThrow();
    });

    it("resolves without throwing when all API calls fail", async () => {
      const mockGet = await getMockApiGet();
      mockGet.mockRejectedValue(new Error("Network error"));
      await expect(
        usePanelStore.getState().fetchInitialData("proj-1"),
      ).resolves.not.toThrow();
    });

    it("updates brainstorm diverge from API data", async () => {
      const mockGet = await getMockApiGet();
      mockGet
        .mockResolvedValueOnce({
          ok: true,
          data: [{ id: "b1", title: "玄幻方向" }, { id: "b2", title: null }],
        })
        .mockResolvedValueOnce({ ok: true, data: [] })
        .mockResolvedValueOnce({ ok: true, data: [] })
        .mockResolvedValueOnce({ ok: true, data: { outline: null, arcs: [] } })
        .mockResolvedValueOnce({ ok: true, data: [] });

      await usePanelStore.getState().fetchInitialData("proj-1");

      const brainstorm = usePanelStore.getState().brainstorm;
      expect(brainstorm?.diverge).toHaveLength(2);
      expect(brainstorm?.diverge[0]?.title).toBe("玄幻方向");
      expect(brainstorm?.diverge[1]?.title).toBe("");
    });

    it("updates characters from API data", async () => {
      const mockGet = await getMockApiGet();
      mockGet
        .mockResolvedValueOnce({ ok: true, data: [] })
        .mockResolvedValueOnce({ ok: true, data: [] })
        .mockResolvedValueOnce({
          ok: true,
          data: [
            {
              id: "c1",
              name: "主角",
              role: "protagonist",
              designTier: "核心层",
              description: "勇敢的少年",
              personality: "乐观",
              background: null,
              arc: "成长弧",
            },
          ],
        })
        .mockResolvedValueOnce({ ok: true, data: { outline: null, arcs: [] } })
        .mockResolvedValueOnce({ ok: true, data: [] });

      await usePanelStore.getState().fetchInitialData("proj-1");

      const chars = usePanelStore.getState().characters;
      expect(chars?.characters).toHaveLength(1);
      expect(chars?.characters[0]?.name).toBe("主角");
      expect(chars?.characters[0]?.designTier).toBe("核心层");
      expect(chars?.characters[0]?.oneLiner).toBe("勇敢的少年");
      expect(chars?.filterRole).toBeNull();
    });

    it("defaults unknown designTier to 支撑层", async () => {
      const mockGet = await getMockApiGet();
      mockGet
        .mockResolvedValueOnce({ ok: true, data: [] })
        .mockResolvedValueOnce({ ok: true, data: [] })
        .mockResolvedValueOnce({
          ok: true,
          data: [
            {
              id: "c1",
              name: "配角",
              role: null,
              designTier: null,
              description: null,
              personality: null,
              background: null,
              arc: null,
            },
          ],
        })
        .mockResolvedValueOnce({ ok: true, data: { outline: null, arcs: [] } })
        .mockResolvedValueOnce({ ok: true, data: [] });

      await usePanelStore.getState().fetchInitialData("proj-1");

      const chars = usePanelStore.getState().characters;
      expect(chars?.characters[0]?.designTier).toBe("支撑层");
      expect(chars?.characters[0]?.role).toBe("supporting");
    });

    it("updates chapters list from API data", async () => {
      const mockGet = await getMockApiGet();
      mockGet
        .mockResolvedValueOnce({ ok: true, data: [] })
        .mockResolvedValueOnce({ ok: true, data: [] })
        .mockResolvedValueOnce({ ok: true, data: [] })
        .mockResolvedValueOnce({ ok: true, data: { outline: null, arcs: [] } })
        .mockResolvedValueOnce({
          ok: true,
          data: [
            { chapterNumber: 1, title: "第一章", wordCount: 3200, status: "archived" },
            { chapterNumber: 2, title: null, wordCount: null, status: null },
          ],
        });

      await usePanelStore.getState().fetchInitialData("proj-1");

      const chapters = usePanelStore.getState().chapters;
      expect(chapters?.chapterList).toHaveLength(2);
      expect(chapters?.chapterList[0]?.number).toBe(1);
      expect(chapters?.chapterList[0]?.title).toBe("第一章");
      expect(chapters?.chapterList[0]?.wordCount).toBe(3200);
      expect(chapters?.chapterList[1]?.title).toBe("");
      expect(chapters?.chapterList[1]?.wordCount).toBe(0);
      expect(chapters?.chapterList[1]?.status).toBe("pending");
    });

    it("updates outline arcs from API data", async () => {
      const mockGet = await getMockApiGet();
      mockGet
        .mockResolvedValueOnce({ ok: true, data: [] })
        .mockResolvedValueOnce({ ok: true, data: [] })
        .mockResolvedValueOnce({ ok: true, data: [] })
        .mockResolvedValueOnce({
          ok: true,
          data: {
            outline: null,
            arcs: [{ id: "arc-1", title: "第一卷", startChapter: 1, endChapter: 20 }],
          },
        })
        .mockResolvedValueOnce({ ok: true, data: [] });

      await usePanelStore.getState().fetchInitialData("proj-1");

      const outline = usePanelStore.getState().outline;
      expect(outline?.arcs).toHaveLength(1);
      expect(outline?.arcs[0]?.title).toBe("第一卷");
      expect(outline?.arcs[0]?.chapterRange).toBe("1–20");
    });

    it("updates world categories from world-settings sections", async () => {
      const mockGet = await getMockApiGet();
      mockGet
        .mockResolvedValueOnce({ ok: true, data: [] })
        .mockResolvedValueOnce({
          ok: true,
          data: [
            { id: "w1", section: "geography", name: "大陆" },
            { id: "w2", section: "magic", name: "魔法体系" },
            { id: "w3", section: "geography", name: "海洋" },
          ],
        })
        .mockResolvedValueOnce({ ok: true, data: [] })
        .mockResolvedValueOnce({ ok: true, data: { outline: null, arcs: [] } })
        .mockResolvedValueOnce({ ok: true, data: [] });

      await usePanelStore.getState().fetchInitialData("proj-1");

      const world = usePanelStore.getState().world;
      expect(world?.categories).toHaveLength(2);
      expect(world?.categories).toContain("geography");
      expect(world?.categories).toContain("magic");
    });

    it("does not overwrite existing brainstorm converge/crystal when setting diverge", async () => {
      usePanelStore.setState({
        brainstorm: {
          diverge: [],
          converge: { selectedDirections: [], genre: "玄幻", coreConflict: "", targetAudience: "" },
          crystal: null,
        },
      });

      const mockGet = await getMockApiGet();
      mockGet
        .mockResolvedValueOnce({ ok: true, data: [{ id: "b1", title: "New" }] })
        .mockResolvedValueOnce({ ok: true, data: [] })
        .mockResolvedValueOnce({ ok: true, data: [] })
        .mockResolvedValueOnce({ ok: true, data: { outline: null, arcs: [] } })
        .mockResolvedValueOnce({ ok: true, data: [] });

      await usePanelStore.getState().fetchInitialData("proj-1");

      const brainstorm = usePanelStore.getState().brainstorm;
      expect(brainstorm?.converge?.genre).toBe("玄幻");
      expect(brainstorm?.diverge).toHaveLength(1);
    });

    it("skips update when API returns ok: false", async () => {
      const mockGet = await getMockApiGet();
      mockGet
        .mockResolvedValueOnce({ ok: false, error: { code: "NOT_FOUND", message: "not found" } })
        .mockResolvedValueOnce({ ok: true, data: [] })
        .mockResolvedValueOnce({ ok: true, data: [] })
        .mockResolvedValueOnce({ ok: true, data: { outline: null, arcs: [] } })
        .mockResolvedValueOnce({ ok: true, data: [] });

      await usePanelStore.getState().fetchInitialData("proj-1");

      // brainstorm should remain null since API returned ok: false
      expect(usePanelStore.getState().brainstorm).toBeNull();
    });
  });
});
