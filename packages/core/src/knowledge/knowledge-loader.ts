/**
 * KnowledgeLoader — Agent 感知的知识库加载器
 *
 * 根据 §4.11 的加载策略，为不同 Agent 按角色筛选知识库条目:
 *
 * | 类型       | 策略      | 消费方         |
 * |-----------|----------|---------------|
 * | 写作技巧   | Eager    | 执笔           |
 * | 题材知识   | Selective| 执笔、匠心      |
 * | 风格专项   | On-demand| 执笔           |
 * | 经验教训   | Filtered | 执笔、明镜      |
 * | 析典沉淀   | Tagged   | 灵犀、匠心、执笔、明镜 |
 */

import { createLogger } from "../logger/index.js";
import type { KnowledgeStore } from "./knowledge-service.js";
import type { LessonStore } from "./lessons-service.js";
import type {
  KnowledgeEntry,
  Lesson,
  KnowledgeLoadRequest,
  LoadedKnowledge,
  LoadStrategy,
  KnowledgeScope,
} from "./types.js";
import { AGENT_KNOWLEDGE_BUDGETS, MAX_ENTRY_TOKENS } from "./types.js";

const logger = createLogger("knowledge-loader");

function estimateTokens(text: string): number {
  // 中文: ~1.5 chars per token on average
  return Math.max(1, Math.ceil(text.length / 1.5));
}

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = Math.floor(maxTokens * 1.5);
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "…";
}

/**
 * Agent 角色到加载策略的映射
 */
const AGENT_LOAD_RULES: Record<string, {
  eagerCategories: string[];
  selectiveCategories: string[];
  onDemandCategories: string[];
  loadLessons: boolean;
  loadReference: boolean;
}> = {
  执笔: {
    eagerCategories: ["writing_craft"],
    selectiveCategories: ["genre"],
    onDemandCategories: ["style"],
    loadLessons: true,
    loadReference: true,
  },
  明镜: {
    eagerCategories: [],
    selectiveCategories: [],
    onDemandCategories: [],
    loadLessons: true,
    loadReference: true,
  },
  灵犀: {
    eagerCategories: [],
    selectiveCategories: [],
    onDemandCategories: [],
    loadLessons: false,
    loadReference: true,
  },
  匠心: {
    eagerCategories: [],
    selectiveCategories: ["genre"],
    onDemandCategories: [],
    loadLessons: false,
    loadReference: true,
  },
};

export class KnowledgeLoader {
  constructor(
    private readonly knowledgeStore: KnowledgeStore,
    private readonly lessonStore: LessonStore,
  ) {}

  /**
   * 为指定 Agent 加载知识库
   *
   * 自动按策略筛选、按 token 预算截断
   */
  async load(request: KnowledgeLoadRequest): Promise<LoadedKnowledge> {
    const { consumer, projectId, genreTags, chapterType, maxTokens } = request;

    const budget = this.getBudget(consumer, maxTokens);
    const rules = AGENT_LOAD_RULES[consumer];
    const loadStrategyMap: Record<string, LoadStrategy> = {};

    const scopes: KnowledgeScope[] = ["global", `project:${projectId}`];
    let entries: KnowledgeEntry[] = [];
    let lessons: Lesson[] = [];
    let usedTokens = 0;

    if (!rules) {
      // Unknown agent — just load tagged entries
      const tagged = await this.knowledgeStore.findByConsumer(consumer, scopes);
      entries = tagged;
      loadStrategyMap.tagged = "tagged";
    } else {
      // 1. Eager — always load (写作技巧)
      if (rules.eagerCategories.length > 0) {
        for (const category of rules.eagerCategories) {
          const globalEntries = await this.knowledgeStore.findByScopeAndCategory("global", category as "writing_craft" | "genre" | "style" | "reference");
          const projEntries = await this.knowledgeStore.findByScopeAndCategory(`project:${projectId}`, category as "writing_craft" | "genre" | "style" | "reference");
          entries.push(...globalEntries, ...projEntries);
        }
        loadStrategyMap.writing_craft = "eager";
      }

      // 2. Selective — by genre tags (题材知识)
      if (rules.selectiveCategories.length > 0 && genreTags && genreTags.length > 0) {
        for (const category of rules.selectiveCategories) {
          const allGenre = await this.knowledgeStore.findByScopeAndCategory("global", category as "writing_craft" | "genre" | "style" | "reference");
          const projGenre = await this.knowledgeStore.findByScopeAndCategory(`project:${projectId}`, category as "writing_craft" | "genre" | "style" | "reference");
          const combined = [...allGenre, ...projGenre];
          const genreTagSet = new Set(genreTags.map((t) => t.toLowerCase()));
          const filtered = combined.filter((e) =>
            e.tags.some((tag) => genreTagSet.has(tag.toLowerCase())),
          );
          entries.push(...filtered);
        }
        loadStrategyMap.genre = "selective";
      }

      // 3. On-demand — by chapter type (风格专项)
      if (rules.onDemandCategories.length > 0 && chapterType) {
        for (const category of rules.onDemandCategories) {
          const allStyle = await this.knowledgeStore.findByScopeAndCategory("global", category as "writing_craft" | "genre" | "style" | "reference");
          const projStyle = await this.knowledgeStore.findByScopeAndCategory(`project:${projectId}`, category as "writing_craft" | "genre" | "style" | "reference");
          const combined = [...allStyle, ...projStyle];
          const typeTag = chapterType.toLowerCase();
          const filtered = combined.filter((e) =>
            e.tags.some((tag) => tag.toLowerCase() === typeTag),
          );
          entries.push(...filtered);
        }
        loadStrategyMap.style = "on_demand";
      }

      // 4. Tagged — by consumer label (析典沉淀)
      if (rules.loadReference) {
        const tagged = await this.knowledgeStore.findByConsumer(consumer, scopes);
        // Only add reference entries not already loaded
        const existingIds = new Set(entries.map((e) => e.id));
        const newTagged = tagged.filter((e) => !existingIds.has(e.id));
        entries.push(...newTagged);
        loadStrategyMap.reference = "tagged";
      }

      // 5. Filtered — lessons (经验教训)
      if (rules.loadLessons) {
        const activeLessons = await this.lessonStore.findActive(projectId);
        // Filter by relevance if we have chapter tags
        if (genreTags && genreTags.length > 0) {
          const tagSet = new Set(genreTags.map((t) => t.toLowerCase()));
          lessons = activeLessons.filter((l) =>
            !l.tags || l.tags.length === 0 || l.tags.some((t) => tagSet.has(t.toLowerCase())),
          );
        } else {
          lessons = activeLessons;
        }
        loadStrategyMap.lessons = "filtered";
      }
    }

    // De-duplicate entries by ID
    const seen = new Set<string>();
    entries = entries.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    // Truncate to token budget
    const truncatedEntries: KnowledgeEntry[] = [];
    for (const entry of entries) {
      const tokens = estimateTokens(entry.content);
      if (usedTokens + Math.min(tokens, MAX_ENTRY_TOKENS) > budget) break;
      if (tokens > MAX_ENTRY_TOKENS) {
        truncatedEntries.push({
          ...entry,
          content: truncateToTokens(entry.content, MAX_ENTRY_TOKENS),
        });
        usedTokens += MAX_ENTRY_TOKENS;
      } else {
        truncatedEntries.push(entry);
        usedTokens += tokens;
      }
    }

    // Also truncate lessons
    const truncatedLessons: Lesson[] = [];
    for (const lesson of lessons) {
      const tokens = estimateTokens(lesson.description);
      if (usedTokens + tokens > budget) break;
      truncatedLessons.push(lesson);
      usedTokens += tokens;
    }

    logger.info(
      { consumer, entries: truncatedEntries.length, lessons: truncatedLessons.length, totalTokens: usedTokens, budget },
      "Knowledge loaded",
    );

    return {
      entries: truncatedEntries,
      lessons: truncatedLessons,
      totalTokens: usedTokens,
      loadStrategy: loadStrategyMap,
    };
  }

  /**
   * 计算 Agent 知识库 token 预算
   */
  private getBudget(consumer: string, override?: number): number {
    if (override !== undefined) return override;

    const agentBudget = AGENT_KNOWLEDGE_BUDGETS[consumer];
    if (agentBudget) {
      return Math.floor(agentBudget.totalBudget * agentBudget.knowledgeRatio);
    }
    // Fallback: 3200 tokens
    return 3200;
  }
}
