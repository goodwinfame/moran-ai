/**
 * Panel Store — Zustand store for the info-panel right side.
 * Manages all 8 tab data slices, badge/visibility state, and IndexedDB cache.
 *
 * Phase 5.3: info-panel infrastructure
 */

import { create } from "zustand";
import { get as idbGet, set as idbSet } from "idb-keyval";
import type { TabId } from "@/lib/panel-event-router";
import { api } from "@/lib/api";
import type {
  BrainstormData,
  WorldData,
  WorldDetail,
  CharacterData,
  OutlineData,
  ForeshadowData,
  TimelineData,
  ChapterData,
  ReviewData,
  AnalysisData,
  ExternalAnalysisData,
  KnowledgeData,
  WorldPatch,
  CharacterPatch,
  OutlinePatch,
  ForeshadowPatch,
  TimelinePatch,
  ChapterPatch,
  ReviewPatch,
  ExternalAnalysisPatch,
  KnowledgePatch,
} from "./panel-store-types";
import {
  applyBrainstormUpdate,
  applyWorldUpdate,
  applyCharactersUpdate,
  applyOutlineUpdate,
  applyForeshadowsUpdate,
  applyTimelineUpdate,
  applyChapterUpdate,
  applyReviewUpdate,
  applyAnalysisUpdate,
  applyExternalAnalysisUpdate,
  applyKnowledgeUpdate,
} from "./panel-store-updaters";
import { fetchInitialData as fetchInitialDataImpl } from "./panel-store-fetcher";

export type { TabId };
export * from "./panel-store-types";

// ── Badge types ────────────────────────────────────────────────────────────────

export type BadgeType =
  | { type: "dot" }
  | { type: "count"; value: number }
  | { type: "live" };

// ── Fixed tab order ────────────────────────────────────────────────────────────

const TAB_ORDER: TabId[] = [
  "brainstorm",
  "world",
  "character",
  "outline",
  "chapter",
  "review",
  "analysis",
  "knowledge",
];

// ── Persistable state (data only) ─────────────────────────────────────────────

interface PersistedPanelState {
  activeTab: TabId;
  visibleTabs: TabId[];
  brainstorm: BrainstormData | null;
  world: WorldData | null;
  worldDetail: WorldDetail | null;
  characters: CharacterData | null;
  outline: OutlineData | null;
  foreshadows: ForeshadowData | null;
  timeline: TimelineData | null;
  chapters: ChapterData | null;
  reviews: ReviewData | null;
  analysis: AnalysisData | null;
  externalAnalysis: ExternalAnalysisData | null;
  knowledge: KnowledgeData | null;
}

// ── Full store interface ───────────────────────────────────────────────────────

export interface PanelState extends PersistedPanelState {
  badges: Partial<Record<TabId, BadgeType>>;
  lastUserActionTime: number;

  // Tab management
  setActiveTab: (tab: TabId) => void;
  addVisibleTab: (tab: TabId) => void;
  handleAutoSwitch: (tab: TabId) => void;
  addBadge: (tab: TabId, badge: BadgeType) => void;
  clearBadge: (tab: TabId) => void;
  setLastUserAction: (time: number) => void;

  // Per-tab data updates
  updateBrainstorm: (patch: Partial<BrainstormData>) => void;
  updateWorld: (patch: WorldPatch) => void;
  updateCharacters: (patch: CharacterPatch) => void;
  updateOutline: (patch: OutlinePatch) => void;
  updateForeshadows: (patch: ForeshadowPatch) => void;
  updateTimeline: (patch: TimelinePatch) => void;
  updateChapter: (patch: ChapterPatch) => void;
  updateReview: (patch: ReviewPatch) => void;
  updateAnalysis: (data: AnalysisData) => void;
  updateExternalAnalysis: (patch: ExternalAnalysisPatch) => void;
  updateKnowledge: (patch: KnowledgePatch) => void;

  // IDB persistence
  initFromCache: (projectId: string) => Promise<void>;

  // API initial data fetch
  fetchInitialData: (projectId: string) => Promise<void>;

  // World detail on-demand fetch
  fetchWorldDetail: (projectId: string, settingId: string) => Promise<void>;
  clearWorldDetail: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ── IDB persistence helpers ────────────────────────────────────────────────────

let currentProjectId = "";

const debouncedIdbWrite = debounce(
  (projectId: string, state: PersistedPanelState) => {
    void idbSet(`panel:${projectId}`, state);
  },
  1000,
);

// ── Store ──────────────────────────────────────────────────────────────────────

export const usePanelStore = create<PanelState>()((set, get) => ({
  // Initial state
  activeTab: "brainstorm",
  visibleTabs: [],
  badges: {},
  lastUserActionTime: 0,
  brainstorm: null,
  world: null,
  worldDetail: null,
  characters: null,
  outline: null,
  foreshadows: null,
  timeline: null,
  chapters: null,
  reviews: null,
  analysis: null,
  externalAnalysis: null,
  knowledge: null,

  // ── Tab management ──────────────────────────────────────────────────────────

  setActiveTab: (tab: TabId) => {
    set({ activeTab: tab });
  },

  addVisibleTab: (tab: TabId) => {
    set((s) => {
      if (s.visibleTabs.includes(tab)) return s;
      const next = [...s.visibleTabs, tab].sort(
        (a, b) => TAB_ORDER.indexOf(a) - TAB_ORDER.indexOf(b),
      );
      // First visible tab becomes active if no tab was active yet
      const activeTab = s.visibleTabs.length === 0 ? tab : s.activeTab;
      return { visibleTabs: next, activeTab };
    });
  },

  handleAutoSwitch: (tab: TabId) => {
    const state = get();
    const elapsed = Date.now() - state.lastUserActionTime;
    if (elapsed < 10_000) {
      // 10-second protection: add badge instead of switching
      set((s) => ({
        badges: { ...s.badges, [tab]: { type: "dot" } as BadgeType },
      }));
    } else {
      set({ activeTab: tab });
    }
  },

  addBadge: (tab: TabId, badge: BadgeType) => {
    set((s) => {
      const existing = s.badges[tab];
      if (badge.type === "count" && existing?.type === "count") {
        return {
          badges: {
            ...s.badges,
            [tab]: { type: "count", value: existing.value + badge.value } as BadgeType,
          },
        };
      }
      return { badges: { ...s.badges, [tab]: badge } };
    });
  },

  clearBadge: (tab: TabId) => {
    set((s) => {
      const next = { ...s.badges };
      delete next[tab];
      return { badges: next };
    });
  },

  setLastUserAction: (time: number) => {
    set({ lastUserActionTime: time });
  },

  // ── Data updates (delegated to pure updater functions) ──────────────────────

  updateBrainstorm: (patch) => set((s) => applyBrainstormUpdate(s.brainstorm, patch)),
  updateWorld: (patch) => set((s) => applyWorldUpdate(s.world, patch)),
  updateCharacters: (patch) => set((s) => applyCharactersUpdate(s.characters, patch)),
  updateOutline: (patch) => set((s) => applyOutlineUpdate(s.outline, patch)),
  updateForeshadows: (patch) => set((s) => applyForeshadowsUpdate(s.foreshadows, patch)),
  updateTimeline: (patch) => set((s) => applyTimelineUpdate(s.timeline, patch)),
  updateChapter: (patch) => set((s) => applyChapterUpdate(s.chapters, patch)),
  updateReview: (patch) => set((s) => applyReviewUpdate(s.reviews, patch)),
  updateAnalysis: (data) => set(applyAnalysisUpdate(data)),
  updateExternalAnalysis: (patch) =>
    set((s) => applyExternalAnalysisUpdate(s.externalAnalysis, patch)),
  updateKnowledge: (patch) => set((s) => applyKnowledgeUpdate(s.knowledge, patch)),

  // ── IDB persistence ─────────────────────────────────────────────────────────

  initFromCache: async (projectId: string) => {
    currentProjectId = projectId;
    const cached = await idbGet<PersistedPanelState>(`panel:${projectId}`);
    if (cached) {
      usePanelStore.setState({
        activeTab: cached.activeTab ?? "brainstorm",
        visibleTabs: cached.visibleTabs ?? [],
        brainstorm: cached.brainstorm ?? null,
        world: cached.world ?? null,
        characters: cached.characters ?? null,
        outline: cached.outline ?? null,
        foreshadows: cached.foreshadows ?? null,
        timeline: cached.timeline ?? null,
        chapters: cached.chapters ?? null,
        reviews: cached.reviews ?? null,
        analysis: cached.analysis ?? null,
        externalAnalysis: cached.externalAnalysis ?? null,
        knowledge: cached.knowledge ?? null,
      });
    }
  },

  // ── API initial data fetch ───────────────────────────────────────────────────

  fetchInitialData: (projectId: string) => fetchInitialDataImpl(projectId, get),

  // ── World detail on-demand fetch ─────────────────────────────────────────────

  fetchWorldDetail: async (projectId: string, settingId: string) => {
    try {
      const res = await api.get<{ ok: boolean; data: WorldDetail }>(
        `/api/projects/${projectId}/world-settings/${settingId}`
      );
      if (res.ok) {
        set({ worldDetail: res.data });
      }
    } catch {
      // Silent failure — detail page shows fallback
    }
  },

  clearWorldDetail: () => {
    set({ worldDetail: null });
  },
}));

// ── Subscribe to persist data changes to IDB ───────────────────────────────────

usePanelStore.subscribe((state) => {
  if (!currentProjectId) return;
  const persisted: PersistedPanelState = {
    activeTab: state.activeTab,
    visibleTabs: state.visibleTabs,
    brainstorm: state.brainstorm,
    world: state.world,
    characters: state.characters,
    outline: state.outline,
    foreshadows: state.foreshadows,
    timeline: state.timeline,
    chapters: state.chapters,
    reviews: state.reviews,
    analysis: state.analysis,
    externalAnalysis: state.externalAnalysis,
    knowledge: state.knowledge,
    worldDetail: state.worldDetail,
  };
  debouncedIdbWrite(currentProjectId, persisted);
});
