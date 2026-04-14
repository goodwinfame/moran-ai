/**
 * 析典 (xidian) — 参考作品深度分析类型定义
 *
 * 九大分析维度，每项对应一个或多个学术理论框架：
 *   ① 叙事结构 (Genette/Todorov/Campbell/Propp)
 *   ② 角色设计 (Enneagram/WANT-NEED-LIE-GHOST/社会网络分析)
 *   ③ 世界观构建 (Sanderson三定律/力量体系拓扑/政治经济体系)
 *   ④ 伏笔与线索 (契诃夫之枪/Setup-Payoff/红鲱鱼)
 *   ⑤ 节奏与张力 (Scene-Sequel/张力曲线/Genette叙事速度)
 *   ⑥ 爽感机制 (爽感生成体系/金手指类型学/章末钩子)
 *   ⑦ 文风指纹 (计算文体学/可读性指数/对话叙述比)
 *   ⑧ 对话与声音 (角色声音分析/对话归属)
 *   ⑨ 章末钩子 (钩子类型/位置/强度量化)
 */

import type { AgentId } from "../agents/types.js";

// ── 引擎配置 ──────────────────────────────────────

export interface XidianEngineConfig {
  /** 析典使用的 agent ID（需要最强分析推理能力） */
  analysisAgentId: AgentId;
  /** 搜索使用的 agent ID（轻量搜索任务） */
  searchAgentId: AgentId;
  /** 单个维度分析的最大 token */
  maxTokensPerDimension: number;
  /** 是否自动沉淀知识库 */
  autoSettle: boolean;
  /** 知识条目目标 token 数 (≤800) */
  knowledgeEntryMaxTokens: number;
}

export const DEFAULT_XIDIAN_CONFIG: XidianEngineConfig = {
  analysisAgentId: "xidian",
  searchAgentId: "xidian",
  maxTokensPerDimension: 4000,
  autoSettle: true,
  knowledgeEntryMaxTokens: 800,
};

// ── 分析输入 ──────────────────────────────────────

export interface AnalysisInput {
  /** 项目 ID */
  projectId: string;
  /** 作品名 */
  workTitle: string;
  /** 作者名（可选） */
  authorName?: string;
  /** 用户补充说明 */
  userNotes?: string;
  /** 用户直接提供的文本片段（可选，优先于搜索结果） */
  providedTexts?: string[];
  /** 要执行的维度（默认全部九维） */
  dimensions?: AnalysisDimension[];
}

/** 九大分析维度 */
export type AnalysisDimension =
  | "narrative_structure"
  | "character_design"
  | "world_building"
  | "foreshadowing"
  | "pacing_tension"
  | "shuanggan_mechanics"
  | "style_fingerprint"
  | "dialogue_voice"
  | "chapter_hooks";

export const ALL_DIMENSIONS: AnalysisDimension[] = [
  "narrative_structure",
  "character_design",
  "world_building",
  "foreshadowing",
  "pacing_tension",
  "shuanggan_mechanics",
  "style_fingerprint",
  "dialogue_voice",
  "chapter_hooks",
];

export const DIMENSION_LABELS: Record<AnalysisDimension, string> = {
  narrative_structure: "① 叙事结构分析",
  character_design: "② 角色设计技法",
  world_building: "③ 世界观构建",
  foreshadowing: "④ 伏笔与线索",
  pacing_tension: "⑤ 节奏与张力",
  shuanggan_mechanics: "⑥ 爽感机制",
  style_fingerprint: "⑦ 文风指纹",
  dialogue_voice: "⑧ 对话与声音",
  chapter_hooks: "⑨ 章末钩子",
};

// ── 搜索素材 ──────────────────────────────────────

export interface SearchMaterial {
  /** 素材来源 */
  source: string;
  /** 素材类型 */
  type: "metadata" | "sample_text" | "review" | "analysis" | "user_provided";
  /** 素材内容 */
  content: string;
  /** 来源 URL（如果有） */
  url?: string;
}

export interface SearchResult {
  /** 作品元数据 */
  metadata: WorkMetadata;
  /** 收集到的素材 */
  materials: SearchMaterial[];
  /** 搜索用量 */
  usage: { inputTokens: number; outputTokens: number };
}

export interface WorkMetadata {
  /** 作品名 */
  title: string;
  /** 作者 */
  author: string;
  /** 类型/标签 */
  tags: string[];
  /** 简介 */
  synopsis: string;
  /** 总字数（如果已知） */
  wordCount?: number;
  /** 评分（如果已知） */
  rating?: number;
  /** 平台 */
  platform?: string;
}

// ── 维度分析结果 ──────────────────────────────────

export interface DimensionAnalysis {
  /** 维度标识 */
  dimension: AnalysisDimension;
  /** 维度名称 */
  label: string;
  /** 分析内容（Markdown 格式） */
  content: string;
  /** 结构化数据（YAML 字符串，维度专用） */
  structuredData?: string;
  /** 可操作建议（给其他 Agent 的具体指导） */
  actionableInsights: string[];
  /** 适用的消费方 */
  consumers: ConsumerAgent[];
}

/** 知识消费方 Agent */
export type ConsumerAgent = "lingxi" | "jiangxin" | "zhibi" | "mingjing" | "bowen";

// ── 完整分析报告 ──────────────────────────────────

export interface AnalysisReport {
  /** 项目 ID */
  projectId: string;
  /** 作品信息 */
  work: WorkMetadata;
  /** 各维度分析结果 */
  dimensions: DimensionAnalysis[];
  /** 综合摘要 */
  overallSummary: string;
  /** 总 LLM 用量 */
  totalUsage: { inputTokens: number; outputTokens: number };
}

// ── 知识沉淀 ──────────────────────────────────────

export interface SettlementEntry {
  /** 标题 */
  title: string;
  /** 内容（散文式指南） */
  content: string;
  /** 分类 */
  category: "writing_technique" | "genre_knowledge" | "style_guide" | "reference_analysis";
  /** 来源维度 */
  sourceDimension: AnalysisDimension;
  /** 来源作品 */
  sourceWork: string;
  /** 适用消费方 */
  consumers: ConsumerAgent[];
  /** 作用范围 */
  scope: "global" | `project:${string}`;
}

export interface SettlementResult {
  /** 生成的知识库条目 */
  entries: SettlementEntry[];
  /** 用量 */
  usage: { inputTokens: number; outputTokens: number };
}

// ── 进度回调 ──────────────────────────────────────

export interface AnalysisProgress {
  stage: "search" | "analyze" | "report" | "settle";
  dimension?: AnalysisDimension;
  message: string;
  /** 0-1 进度百分比 */
  progress?: number;
}
