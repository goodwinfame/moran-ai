/**
 * 明镜审校系统 — 类型定义
 *
 * §4.5 明镜 (mingjing) — 多维审校系统
 *
 * 三轮核心审校：
 *   Round 1: AI 味检测（纯代码分析，复用 anti-ai-checker）
 *   Round 2: 逻辑一致性（LLM 调用，对照角色/世界/时间线）
 *   Round 3: 文学质量（LLM 调用，RUBRIC 7 维度评分）
 *
 * 通过标准：
 *   1. 无 CRITICAL 级问题
 *   2. MAJOR 级问题 < 2
 *   3. 综合分 ≥ 7.5
 *   4. Burstiness ≥ 0.3
 */

import type { ReviewIssue, ReviewReport } from "../events/types.js";
import type { AntiAiCheckResult } from "../style/types.js";

// ── 审校轮次 ──────────────────────────────────────────

/** 审校轮次标识 */
export type ReviewRound = 1 | 2 | 3;

/** 审校轮次名称 */
export const REVIEW_ROUND_NAMES: Record<ReviewRound, string> = {
  1: "AI 味检测",
  2: "逻辑一致性",
  3: "文学质量",
};

// ── RUBRIC 评分 ──────────────────────────────────────────

/** RUBRIC 7 维度 ID */
export type RubricDimensionId =
  | "narrative_rhythm"    // 叙事节奏
  | "conflict_tension"    // 冲突张力
  | "character_depth"     // 人物深度
  | "dialogue_natural"    // 对话自然度
  | "emotional_resonance" // 情感共鸣
  | "staleness"           // 呆板度检测
  | "creative_novelty";   // 创意独特性

/** RUBRIC 维度定义 */
export interface RubricDimension {
  /** 维度 ID */
  id: RubricDimensionId;
  /** 中文名称 */
  name: string;
  /** 权重 (0-1, 总计 = 1.0) */
  weight: number;
  /** 检测方法描述 */
  description: string;
}

/** 单维度评分结果 */
export interface RubricDimensionScore {
  /** 维度 ID */
  dimensionId: RubricDimensionId;
  /** 分数 (1-10) */
  score: number;
  /** 评分理由 */
  rationale: string;
}

/** 完整 RUBRIC 评分 */
export interface RubricScore {
  /** 各维度评分 */
  dimensions: RubricDimensionScore[];
  /** 加权综合分 (1-10) */
  weightedScore: number;
  /** 综合评语 */
  overallComment: string;
}

// ── 审校配置 ──────────────────────────────────────────

/** 审校引擎配置 */
export interface ReviewEngineConfig {
  /** Burstiness 通过门槛 */
  burstinessThreshold: number;
  /** 综合分通过门槛 */
  passingScore: number;
  /** 最大 MAJOR 问题数（≥ 此数不通过） */
  maxMajorIssues: number;
  /** 是否启用 Round 2 逻辑一致性（需要 LLM） */
  enableConsistencyCheck: boolean;
  /** 是否启用 Round 3 文学质量（需要 LLM） */
  enableLiteraryCheck: boolean;
}

export const DEFAULT_REVIEW_CONFIG: ReviewEngineConfig = {
  burstinessThreshold: 0.3,
  passingScore: 7.5,
  maxMajorIssues: 2,
  enableConsistencyCheck: true,
  enableLiteraryCheck: true,
};

// ── 一致性检查上下文 ──────────────────────────────────

/**
 * Round 2 一致性检查需要的参考上下文
 *
 * 从 ContextAssembler / DB 获取，传递给明镜 LLM
 */
export interface ConsistencyContext {
  /** 相关角色的 WANT/NEED/LIE/GHOST 及当前状态 */
  characterProfiles?: string;
  /** 世界设定规则摘要 */
  worldRules?: string;
  /** 时间线摘要 */
  timeline?: string;
  /** 活跃伏笔列表 */
  activeForeshadowing?: string;
  /** 前 N 章摘要 */
  recentSummaries?: string;
  /** 风格配置中的 reviewer_focus */
  reviewerFocus?: string[];
}

// ── 单轮审校结果 ──────────────────────────────────────────

/** Round 1 结果（纯代码分析） */
export interface Round1Result {
  round: 1;
  /** Anti-AI 检测结果 */
  antiAiCheck: AntiAiCheckResult;
  /** 转换为标准 ReviewIssue 格式的问题 */
  issues: ReviewIssue[];
}

/** Round 2 结果（LLM 一致性检查） */
export interface Round2Result {
  round: 2;
  /** LLM 检测到的问题 */
  issues: ReviewIssue[];
  /** LLM 原始响应（用于调试） */
  rawResponse?: string;
}

/** Round 3 结果（LLM RUBRIC 评分） */
export interface Round3Result {
  round: 3;
  /** RUBRIC 评分 */
  rubricScore: RubricScore;
  /** LLM 检测到的问题 */
  issues: ReviewIssue[];
  /** LLM 原始响应（用于调试） */
  rawResponse?: string;
}

/** 任一轮审校结果 */
export type ReviewRoundResult = Round1Result | Round2Result | Round3Result;

// ── 完整审校结果 ──────────────────────────────────────────

/** 完整三轮审校的综合结果 */
export interface FullReviewResult {
  /** 是否通过 */
  passed: boolean;
  /** 综合分（Round 3 RUBRIC 加权分，未启用 Round 3 时用 placeholder） */
  score: number;
  /** Burstiness 值 */
  burstiness: number;
  /** 各轮结果 */
  rounds: ReviewRoundResult[];
  /** 汇总的所有问题 */
  allIssues: ReviewIssue[];
  /** 不通过的原因（通过时为空） */
  failReasons: string[];
  /** 转换为 SSE ReviewReport 格式 */
  toReport(round: number): ReviewReport;
}

// ── 审校引擎的写作输入 ──────────────────────────────────

/** 提交给审校引擎的章节数据 */
export interface ReviewInput {
  /** 章节内容 */
  content: string;
  /** 章节号 */
  chapterNumber: number;
  /** 弧段号 */
  arcNumber: number;
  /** 禁忌词规则（来自风格配置） */
  forbidden?: import("../style/types.js").ForbiddenRules;
  /** 一致性检查上下文（Round 2 需要） */
  consistencyContext?: ConsistencyContext;
}
