/**
 * Panel Store Fetcher — Initial API data fetch on project load.
 * Fetches all tab data in parallel and populates the store via updater actions.
 */

import { api } from "@/lib/api";
import type {
  Character,
  OutlineArc,
  ChapterListItem,
  WorldPatch,
  CharacterPatch,
  OutlinePatch,
  ChapterPatch,
  BrainstormData,
} from "./panel-store-types";

// ── Minimal interface for the actions this module needs ────────────────────────

interface FetchActions {
  updateBrainstorm: (patch: Partial<BrainstormData>) => void;
  updateWorld: (patch: WorldPatch) => void;
  updateCharacters: (patch: CharacterPatch) => void;
  updateOutline: (patch: OutlinePatch) => void;
  updateChapter: (patch: ChapterPatch) => void;
}

// ── API response shapes ────────────────────────────────────────────────────────

// Response wrapper type — backend ok() helper always returns { ok, data }
interface ApiResponse<T> {
  ok: boolean;
  data: T;
}

// DB brainstorm document shape as serialised by the API
interface ApiDocument {
  id: string;
  title?: string | null;
}

// DB world-setting shape as serialised by the API
interface ApiWorldSetting {
  id: string;
  section?: string | null;
  name?: string | null;
}

// DB character shape as serialised by the API
interface ApiCharacter {
  id: string;
  name: string;
  role?: string | null;
  designTier?: string | null;
  description?: string | null;
  personality?: string | null;
  background?: string | null;
  arc?: string | null;
  wound?: string | null;
}

// DB arc shape as serialised by the API
interface ApiArc {
  id: string;
  title?: string | null;
  startChapter?: number | null;
  endChapter?: number | null;
}

// DB chapter shape as serialised by the API
interface ApiChapter {
  id: string;
  chapterNumber: number;
  title?: string | null;
  status?: string | null;
  wordCount?: number | null;
}

// ── Main fetch function ────────────────────────────────────────────────────────

export async function fetchInitialData(
  projectId: string,
  get: () => FetchActions,
): Promise<void> {
  const results = await Promise.allSettled([
    api.get<ApiResponse<ApiDocument[]>>(`/api/projects/${projectId}/brainstorms`),
    api.get<ApiResponse<ApiWorldSetting[]>>(`/api/projects/${projectId}/world-settings`),
    api.get<ApiResponse<ApiCharacter[]>>(`/api/projects/${projectId}/characters`),
    api.get<ApiResponse<{ outline: unknown; arcs: ApiArc[] }>>(
      `/api/projects/${projectId}/outline`,
    ),
    api.get<ApiResponse<ApiChapter[]>>(`/api/projects/${projectId}/chapters`),
  ]);

  const [brainstormsResult, worldResult, charactersResult, outlineResult, chaptersResult] =
    results;

  // Brainstorm — map DB documents to diverge directions
  if (brainstormsResult.status === "fulfilled" && brainstormsResult.value.ok) {
    const docs = brainstormsResult.value.data;
    const diverge = docs.map((d) => ({ id: d.id, title: d.title ?? "", starred: false }));
    get().updateBrainstorm({ diverge });
  }

  // World-settings — extract unique categories from section field
  if (worldResult.status === "fulfilled" && worldResult.value.ok) {
    const items = worldResult.value.data;
    const categories = [
      ...new Set(items.map((i) => i.section).filter((s): s is string => s != null)),
    ];
    get().updateWorld({
      type: "set",
      data: { categories, subsystems: [], activeSubsystemId: null },
    });
  }

  // Characters — map DB record to panel Character type
  if (charactersResult.status === "fulfilled" && charactersResult.value.ok) {
    const rawChars = charactersResult.value.data;
    const chars: Character[] = rawChars.map((c): Character => {
      const tier = c.designTier;
      const designTier: Character["designTier"] =
        tier === "核心层" || tier === "重要层" || tier === "支撑层" || tier === "点缀层"
          ? tier
          : "支撑层";
      return {
        id: c.id,
        name: c.name,
        role: c.role ?? "supporting",
        designTier,
        oneLiner: c.description ?? undefined,
        biography: c.background ?? undefined,
        personality: c.personality ?? undefined,
        arc: c.arc ?? undefined,
        wound: c.wound ?? undefined,
      };
    });
    get().updateCharacters({ type: "set", data: { characters: chars, filterRole: null } });
  }

  // Outline arcs — map DB Arc records to panel OutlineArc type
  if (outlineResult.status === "fulfilled" && outlineResult.value.ok) {
    const apiArcs = outlineResult.value.data.arcs ?? [];
    const storeArcs: OutlineArc[] = apiArcs.map((arc): OutlineArc => ({
      id: arc.id,
      title: arc.title ?? "",
      chapterRange:
        arc.startChapter != null && arc.endChapter != null
          ? `${arc.startChapter}\u2013${arc.endChapter}`
          : "",
      chapters: [],
    }));
    get().updateOutline({ type: "set", data: { arcs: storeArcs } });
  }

  // Chapters — map DB Chapter records to panel ChapterListItem type
  if (chaptersResult.status === "fulfilled" && chaptersResult.value.ok) {
    const chapterList: ChapterListItem[] = chaptersResult.value.data.map(
      (ch): ChapterListItem => ({
        number: ch.chapterNumber,
        title: ch.title ?? "",
        status: ch.status ?? "pending",
        wordCount: ch.wordCount ?? 0,
      }),
    );
    get().updateChapter({ chapterList });
  }
}
