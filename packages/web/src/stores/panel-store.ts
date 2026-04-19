/**
 * Panel Store — Zustand store for the info-panel right side.
 * Manages all 8 tab data slices, badge/visibility state, and IndexedDB cache.
 *
 * Phase 5.3: info-panel infrastructure
 */

import { create } from "zustand";
import { get as idbGet, set as idbSet } from "idb-keyval";
import type { TabId } from "@/lib/panel-event-router";
import type {
  BrainstormData,
  WorldData,
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
  ForeshadowEntry,
} from "./panel-store-types";

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

const defaultChapterData = (): ChapterData => ({
  mode: "reading",
  chapterList: [],
  selectedChapter: null,
  writingProgress: null,
  streamingContent: "",
  isAutoFollow: true,
});

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

  // ── Data updates ────────────────────────────────────────────────────────────

  updateBrainstorm: (patch: Partial<BrainstormData>) => {
    set((s) => ({
      brainstorm: {
        ...(s.brainstorm ?? { diverge: [], converge: null, crystal: null }),
        ...patch,
      },
    }));
  },

  updateWorld: (patch: WorldPatch) => {
    set((s) => {
      if (patch.type === "set") return { world: patch.data };
      const current = s.world ?? {
        categories: [],
        subsystems: [],
        activeSubsystemId: null,
      };
      if (patch.type === "addSubsystem") {
        return {
          world: { ...current, subsystems: [...current.subsystems, patch.subsystem] },
        };
      }
      if (patch.type === "patchSubsystem") {
        return {
          world: {
            ...current,
            subsystems: current.subsystems.map((sub) =>
              sub.id === patch.id ? { ...sub, ...patch.update } : sub,
            ),
          },
        };
      }
      if (patch.type === "setActiveSubsystem") {
        return { world: { ...current, activeSubsystemId: patch.id } };
      }
      return s;
    });
  },

  updateCharacters: (patch: CharacterPatch) => {
    set((s) => {
      if (patch.type === "set") return { characters: patch.data };
      const current = s.characters ?? { characters: [], filterRole: null };
      if (patch.type === "add") {
        return {
          characters: {
            ...current,
            characters: [...current.characters, patch.character],
          },
        };
      }
      if (patch.type === "patch") {
        return {
          characters: {
            ...current,
            characters: current.characters.map((c) =>
              c.id === patch.id ? { ...c, ...patch.update } : c,
            ),
          },
        };
      }
      return s;
    });
  },

  updateOutline: (patch: OutlinePatch) => {
    set((s) => {
      if (patch.type === "set") return { outline: patch.data };
      const current = s.outline ?? { arcs: [] };
      if (patch.type === "addArc") {
        return { outline: { ...current, arcs: [...current.arcs, patch.arc] } };
      }
      if (patch.type === "addBrief") {
        return {
          outline: {
            ...current,
            arcs: current.arcs.map((arc) => ({
              ...arc,
              chapters: arc.chapters.map((ch) =>
                ch.number === patch.chapterNumber
                  ? { ...ch, brief: patch.brief }
                  : ch,
              ),
            })),
          },
        };
      }
      if (patch.type === "updateStatus") {
        return {
          outline: {
            ...current,
            arcs: current.arcs.map((arc) => ({
              ...arc,
              chapters: arc.chapters.map((ch) =>
                ch.number === patch.chapterNumber
                  ? { ...ch, status: patch.status }
                  : ch,
              ),
            })),
          },
        };
      }
      return s;
    });
  },

  updateForeshadows: (patch: ForeshadowPatch) => {
    set((s) => {
      if (patch.type === "set") return { foreshadows: patch.data };
      const current = s.foreshadows ?? {
        unresolved: [],
        resolved: [],
        overdue: [],
      };
      if (patch.type === "add") {
        return {
          foreshadows: {
            ...current,
            unresolved: [...current.unresolved, patch.entry],
          },
        };
      }
      if (patch.type === "resolve") {
        const entry = current.unresolved.find((e) => e.id === patch.id);
        if (!entry) return s;
        const resolved: ForeshadowEntry = {
          ...entry,
          resolvedChapter: patch.resolvedChapter,
        };
        return {
          foreshadows: {
            ...current,
            unresolved: current.unresolved.filter((e) => e.id !== patch.id),
            resolved: [...current.resolved, resolved],
          },
        };
      }
      return s;
    });
  },

  updateTimeline: (patch: TimelinePatch) => {
    set((s) => {
      if (patch.type === "set") return { timeline: { events: patch.events } };
      const current = s.timeline ?? { events: [] };
      if (patch.type === "addEvent") {
        return {
          timeline: { ...current, events: [...current.events, patch.event] },
        };
      }
      return s;
    });
  },

  updateChapter: (patch: ChapterPatch) => {
    set((s) => {
      const current = s.chapters ?? defaultChapterData();
      const { appendContent, ...rest } = patch;
      if (appendContent !== undefined) {
        return {
          chapters: {
            ...current,
            ...rest,
            streamingContent: current.streamingContent + appendContent,
          },
        };
      }
      return { chapters: { ...current, ...rest } };
    });
  },

  updateReview: (patch: ReviewPatch) => {
    set((s) => {
      if (patch.type === "set") return { reviews: patch.data };
      const current = s.reviews ?? { chapters: [], selectedChapter: null };
      if (patch.type === "addReview") {
        const existing = current.chapters.find(
          (c) => c.chapterNumber === patch.chapterNumber,
        );
        if (existing) {
          return {
            reviews: {
              ...current,
              chapters: current.chapters.map((c) =>
                c.chapterNumber === patch.chapterNumber
                  ? { ...c, reviews: [...c.reviews, patch.review] }
                  : c,
              ),
            },
          };
        }
        return {
          reviews: {
            ...current,
            chapters: [
              ...current.chapters,
              {
                chapterNumber: patch.chapterNumber,
                title: patch.title,
                reviews: [patch.review],
              },
            ],
          },
        };
      }
      return s;
    });
  },

  updateAnalysis: (data: AnalysisData) => {
    set({ analysis: data });
  },

  updateExternalAnalysis: (patch: ExternalAnalysisPatch) => {
    set((s) => {
      if (patch.type === "set") return { externalAnalysis: patch.data };
      const current = s.externalAnalysis ?? { reports: [] };
      if (patch.type === "add") {
        return {
          externalAnalysis: {
            ...current,
            reports: [...current.reports, patch.report],
          },
        };
      }
      return s;
    });
  },

  updateKnowledge: (patch: KnowledgePatch) => {
    set((s) => {
      if (patch.type === "set") return { knowledge: patch.data };
      const current = s.knowledge ?? {
        entries: [],
        totalCount: 0,
        loadedCount: 0,
      };
      if (patch.type === "add") {
        return {
          knowledge: {
            ...current,
            entries: [...current.entries, patch.entry],
            totalCount: current.totalCount + 1,
            loadedCount: current.loadedCount + 1,
          },
        };
      }
      if (patch.type === "patch") {
        return {
          knowledge: {
            ...current,
            entries: current.entries.map((e) =>
              e.id === patch.id ? { ...e, ...patch.update } : e,
            ),
          },
        };
      }
      if (patch.type === "promote") {
        return {
          knowledge: {
            ...current,
            entries: current.entries.map((e) =>
              e.id === patch.id ? { ...e, scope: "global" as const } : e,
            ),
          },
        };
      }
      return s;
    });
  },

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
  };
  debouncedIdbWrite(currentProjectId, persisted);
});
