/**
 * Knowledge subsystem types
 *
 * 知识库子系统类型定义
 */

// ── Knowledge Entry Types ─────────────────────────────────

export type KnowledgeCategory = "writing_craft" | "genre" | "style" | "reference";
export type KnowledgeScope = "global" | `project:${string}`;

export interface KnowledgeEntry {
  id: string;
  scope: KnowledgeScope;
  category: KnowledgeCategory;
  title: string | null;
  content: string;
  tags: string[];
  consumers: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateKnowledgeInput {
  scope: KnowledgeScope;
  category: KnowledgeCategory;
  title?: string;
  content: string;
  tags?: string[];
  consumers?: string[];
}

export interface UpdateKnowledgeInput {
  title?: string;
  content?: string;
  tags?: string[];
  consumers?: string[];
  updatedBy?: string;
}

export interface KnowledgeFilter {
  scope?: KnowledgeScope;
  category?: KnowledgeCategory;
  tags?: string[];
  consumers?: string[];
}

export interface KnowledgeVersion {
  id: string;
  knowledgeEntryId: string;
  version: number;
  content: string;
  updatedBy: string | null;
  createdAt: Date;
}

// ── Lesson Types ─────────────────────────────────────────

export type LessonStatus = "pending" | "active" | "archived" | "cancelled";
export type LessonSeverity = "critical" | "major" | "minor";

export interface Lesson {
  id: string;
  projectId: string;
  status: LessonStatus;
  severity: LessonSeverity;
  title: string;
  description: string;
  sourceChapter: number | null;
  sourceAgent: string | null;
  issueType: string | null;
  tags: string[];
  lastTriggeredChapter: number | null;
  triggerCount: number;
  inactiveChapters: number;
  expiryThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLessonInput {
  projectId: string;
  severity: LessonSeverity;
  title: string;
  description: string;
  sourceChapter?: number;
  sourceAgent?: string;
  issueType?: string;
  tags?: string[];
}

export interface LessonFilter {
  projectId: string;
  status?: LessonStatus;
  severity?: LessonSeverity;
  issueType?: string;
  tags?: string[];
}

// ── Knowledge Loading Types ──────────────────────────────

export type LoadStrategy = "eager" | "selective" | "on_demand" | "filtered" | "tagged";

export interface KnowledgeLoadRequest {
  /** 目标 Agent 中文名 (如 "执笔", "明镜", "灵犀", "匠心") */
  consumer: string;
  /** 项目 ID (用于加载项目级知识库) */
  projectId: string;
  /** 当前章节号 (用于 lessons 相关性过滤) */
  chapterNumber?: number;
  /** 题材标签 (用于 selective 加载) */
  genreTags?: string[];
  /** 章节类型 (用于 on_demand 加载) */
  chapterType?: string;
  /** token 上限 */
  maxTokens?: number;
}

export interface LoadedKnowledge {
  entries: KnowledgeEntry[];
  lessons: Lesson[];
  totalTokens: number;
  loadStrategy: Record<string, LoadStrategy>;
}

// ── Agent Knowledge Budget ───────────────────────────────

export interface AgentKnowledgeBudget {
  /** 总 token 预算 */
  totalBudget: number;
  /** 知识库占总上下文的比例 */
  knowledgeRatio: number;
  /** 析典沉淀占总上下文的比例 */
  referenceRatio: number;
}

/**
 * Agent 知识库 token 预算分配
 * 来自 §4.11 Token 预算分配表
 */
export const AGENT_KNOWLEDGE_BUDGETS: Record<string, AgentKnowledgeBudget> = {
  灵犀: { totalBudget: 16000, knowledgeRatio: 0.20, referenceRatio: 0.15 },
  匠心: { totalBudget: 32000, knowledgeRatio: 0.15, referenceRatio: 0.10 },
  执笔: { totalBudget: 64000, knowledgeRatio: 0.15, referenceRatio: 0.05 },
  明镜: { totalBudget: 32000, knowledgeRatio: 0.10, referenceRatio: 0.05 },
};

/**
 * 默认 lessons 过期阈值 (章节数)
 * 连续 N 章未被触发的 lesson 标记为 archived
 */
export const DEFAULT_LESSON_EXPIRY_THRESHOLD = 20;

/**
 * 每条知识库条目的 token 上限
 * 来自 §4.11: ≤800 tokens/条
 */
export const MAX_ENTRY_TOKENS = 800;
