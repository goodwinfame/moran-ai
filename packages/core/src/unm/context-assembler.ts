import type { MemoryCategory } from "../types/index.js";
import { DEFAULT_BUDGET, SUMMARIES_HOT_WINDOW } from "./config.js";
import { BudgetAllocator } from "./budget-allocator.js";
import type {
  BudgetAllocation,
  ContextRequest,
  ContextResult,
  ContextSection,
  MemorySlice,
  SliceStore,
} from "./types.js";

const CATEGORIES = Object.keys(DEFAULT_BUDGET) as MemoryCategory[];

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 1.5));
}

function overlapScore(slice: MemorySlice, tags: string[]): number {
  if (tags.length === 0 || slice.relevanceTags.length === 0) {
    return 0;
  }
  const source = new Set(slice.relevanceTags.map((tag: string) => tag.toLowerCase()));
  return tags.reduce((score, tag: string) => score + (source.has(tag.toLowerCase()) ? 1 : 0), 0);
}

function statusRank(slice: MemorySlice): number {
  const tags = new Set(slice.relevanceTags.map((tag) => tag.toLowerCase()));
  if (tags.has("status:planted") || tags.has("planted")) {
    return 0;
  }
  if (tags.has("status:developing") || tags.has("developing")) {
    return 1;
  }
  if (tags.has("status:resolved") || tags.has("resolved")) {
    return 2;
  }
  return 3;
}

export class ContextAssembler {
  constructor(
    private readonly store: SliceStore,
    private readonly allocator: BudgetAllocator = new BudgetAllocator(),
  ) {}

  /** Build complete writing context for a chapter */
  async assemble(request: ContextRequest): Promise<ContextResult> {
    const sceneCharacters = request.sceneCharacters ?? [];
    const sceneTags = request.sceneTags ?? [];

    const boostedBudget = { ...(request.customBudget ?? {}) };
    if (sceneCharacters.length > 0 && boostedBudget.characters === undefined) {
      boostedBudget.characters = DEFAULT_BUDGET.characters + 2000;
    }
    if (sceneTags.length > 0 && boostedBudget.world === undefined) {
      boostedBudget.world = DEFAULT_BUDGET.world + 1000;
    }

    const allocations = this.allocator.allocate({ ...request, customBudget: boostedBudget });
    const sections: ContextSection[] = [];
    const budgetUsage = Object.fromEntries(
      CATEGORIES.map((category) => [category, { allocated: 0, used: 0 }]),
    ) as ContextResult["budgetUsage"];

    for (const allocation of allocations) {
      const rendered = await this.renderCategory(allocation, request, sceneCharacters, sceneTags);
      sections.push(rendered);
      budgetUsage[allocation.category] = { allocated: allocation.tokens, used: rendered.tokenCount };
    }

    return {
      totalTokens: sections.reduce((sum, section) => sum + section.tokenCount, 0),
      sections,
      budgetUsage,
    };
  }

  private async renderCategory(
    allocation: BudgetAllocation,
    request: ContextRequest,
    sceneCharacters: string[],
    sceneTags: string[],
  ): Promise<ContextSection> {
    const slices = await this.retrieveSlices(allocation.category, request, sceneCharacters, sceneTags);
    const sorted = slices.sort(
      (a, b) => b.priorityFloor - a.priorityFloor || b.freshness - a.freshness,
    );

    let used = 0;
    const lines: string[] = [];
    let count = 0;

    for (const slice of sorted) {
      const line = `- ${slice.content}`;
      const cost = slice.tokenCount > 0 ? slice.tokenCount : estimateTokens(line);
      if (used + cost > allocation.tokens) {
        continue;
      }
      lines.push(line);
      used += cost;
      count += 1;
      if (used >= allocation.tokens) {
        break;
      }
    }

    return {
      category: allocation.category,
      content: lines.join("\n"),
      tokenCount: used,
      sliceCount: count,
    };
  }

  private async retrieveSlices(
    category: MemoryCategory,
    request: ContextRequest,
    sceneCharacters: string[],
    sceneTags: string[],
  ): Promise<MemorySlice[]> {
    const projectId = request.projectId;

    if (category === "guidance") {
      const [hot, warm] = await Promise.all([
        this.store.query(projectId, { category, tier: "hot" }),
        this.store.query(projectId, { category, tier: "warm" }),
      ]);

      return [...hot, ...warm].sort((a, b) => {
        const scoreA = a.freshness * (1 + overlapScore(a, sceneTags));
        const scoreB = b.freshness * (1 + overlapScore(b, sceneTags));
        return scoreB - scoreA;
      });
    }

    if (category === "world") {
      const all = await this.store.query(projectId, { category });
      return all
        .filter((slice) => sceneTags.length === 0 || overlapScore(slice, sceneTags) > 0)
        .sort((a, b) => {
          const canonA = a.stability === "canon" ? 1 : 0;
          const canonB = b.stability === "canon" ? 1 : 0;
          return canonB - canonA || b.freshness - a.freshness;
        });
    }

    if (category === "characters") {
      const all = await this.store.query(projectId, { category });
      const characterSet = new Set(sceneCharacters.map((name) => name.toLowerCase()));
      const exact = all.filter((slice) =>
        slice.relevanceTags.some((tag) => characterSet.has(tag.toLowerCase())),
      );
      const network = all.filter(
        (slice) => !exact.includes(slice) && slice.relevanceTags.some((tag) => tag.startsWith("rel:")),
      );
      const fallback = all.filter((slice) => !exact.includes(slice) && !network.includes(slice));
      return [...exact, ...network, ...fallback];
    }

    if (category === "consistency") {
      const all = await this.store.query(projectId, { category });
      return all.sort((a, b) => statusRank(a) - statusRank(b) || (b.sourceChapter ?? 0) - (a.sourceChapter ?? 0));
    }

    if (category === "summaries") {
      const all = await this.store.query(projectId, { category });
      const recent = all.filter(
        (slice) =>
          typeof slice.sourceChapter === "number" &&
          slice.sourceChapter >= request.chapterNumber - SUMMARIES_HOT_WINDOW,
      );
      const arc = all.filter((slice) => slice.scope === "arc");
      const global = all.filter((slice) => slice.scope === "global");
      return [...recent, ...arc, ...global];
    }

    if (category === "outline") {
      return this.store.query(projectId, { category, tier: "hot", scope: "arc" });
    }

    return this.store.query(projectId, { category });
  }
}
