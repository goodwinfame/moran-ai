/**
 * Panel Store Updaters — Pure functions for each per-tab data update.
 * Each function takes the relevant state slice(s) and a patch, returning a
 * partial state object suitable for Zustand's set() merger.
 */

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

// ── Default state factories ────────────────────────────────────────────────────

export function defaultChapterData(): ChapterData {
  return {
    mode: "reading",
    chapterList: [],
    selectedChapter: null,
    writingProgress: null,
    streamingContent: "",
    isAutoFollow: true,
  };
}

// ── Per-tab updaters ───────────────────────────────────────────────────────────

export function applyBrainstormUpdate(
  brainstorm: BrainstormData | null,
  patch: Partial<BrainstormData>,
): { brainstorm: BrainstormData } {
  return {
    brainstorm: {
      ...(brainstorm ?? { diverge: [], converge: null, crystal: null }),
      ...patch,
    },
  };
}

export function applyWorldUpdate(
  world: WorldData | null,
  patch: WorldPatch,
): Partial<{ world: WorldData | null }> {
  if (patch.type === "set") return { world: patch.data };
  const current = world ?? { categories: [], subsystems: [], activeSubsystemId: null };
  if (patch.type === "addSubsystem") {
    return { world: { ...current, subsystems: [...current.subsystems, patch.subsystem] } };
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
  return {};
}

export function applyCharactersUpdate(
  characters: CharacterData | null,
  patch: CharacterPatch,
): Partial<{ characters: CharacterData }> {
  if (patch.type === "set") return { characters: patch.data };
  const current = characters ?? { characters: [], filterRole: null };
  if (patch.type === "add") {
    return { characters: { ...current, characters: [...current.characters, patch.character] } };
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
  return {};
}

export function applyOutlineUpdate(
  outline: OutlineData | null,
  patch: OutlinePatch,
): Partial<{ outline: OutlineData }> {
  if (patch.type === "set") return { outline: patch.data };
  const current = outline ?? { arcs: [] };
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
            ch.number === patch.chapterNumber ? { ...ch, brief: patch.brief } : ch,
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
            ch.number === patch.chapterNumber ? { ...ch, status: patch.status } : ch,
          ),
        })),
      },
    };
  }
  return {};
}

export function applyForeshadowsUpdate(
  foreshadows: ForeshadowData | null,
  patch: ForeshadowPatch,
): Partial<{ foreshadows: ForeshadowData }> {
  if (patch.type === "set") return { foreshadows: patch.data };
  const current = foreshadows ?? { unresolved: [], resolved: [], overdue: [] };
  if (patch.type === "add") {
    return {
      foreshadows: { ...current, unresolved: [...current.unresolved, patch.entry] },
    };
  }
  if (patch.type === "resolve") {
    const entry = current.unresolved.find((e) => e.id === patch.id);
    if (!entry) return {};
    const resolved: ForeshadowEntry = { ...entry, resolvedChapter: patch.resolvedChapter };
    return {
      foreshadows: {
        ...current,
        unresolved: current.unresolved.filter((e) => e.id !== patch.id),
        resolved: [...current.resolved, resolved],
      },
    };
  }
  return {};
}

export function applyTimelineUpdate(
  timeline: TimelineData | null,
  patch: TimelinePatch,
): Partial<{ timeline: TimelineData }> {
  if (patch.type === "set") return { timeline: { events: patch.events } };
  const current = timeline ?? { events: [] };
  if (patch.type === "addEvent") {
    return { timeline: { ...current, events: [...current.events, patch.event] } };
  }
  return {};
}

export function applyChapterUpdate(
  chapters: ChapterData | null,
  patch: ChapterPatch,
): { chapters: ChapterData } {
  const current = chapters ?? defaultChapterData();
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
}

export function applyReviewUpdate(
  reviews: ReviewData | null,
  patch: ReviewPatch,
): Partial<{ reviews: ReviewData }> {
  if (patch.type === "set") return { reviews: patch.data };
  const current = reviews ?? { chapters: [], selectedChapter: null };
  if (patch.type === "addReview") {
    const existing = current.chapters.find((c) => c.chapterNumber === patch.chapterNumber);
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
          { chapterNumber: patch.chapterNumber, title: patch.title, reviews: [patch.review] },
        ],
      },
    };
  }
  return {};
}

export function applyAnalysisUpdate(data: AnalysisData): { analysis: AnalysisData } {
  return { analysis: data };
}

export function applyExternalAnalysisUpdate(
  externalAnalysis: ExternalAnalysisData | null,
  patch: ExternalAnalysisPatch,
): Partial<{ externalAnalysis: ExternalAnalysisData }> {
  if (patch.type === "set") return { externalAnalysis: patch.data };
  const current = externalAnalysis ?? { reports: [] };
  if (patch.type === "add") {
    return { externalAnalysis: { ...current, reports: [...current.reports, patch.report] } };
  }
  return {};
}

export function applyKnowledgeUpdate(
  knowledge: KnowledgeData | null,
  patch: KnowledgePatch,
): Partial<{ knowledge: KnowledgeData }> {
  if (patch.type === "set") return { knowledge: patch.data };
  const current = knowledge ?? { entries: [], totalCount: 0, loadedCount: 0 };
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
  return {};
}
