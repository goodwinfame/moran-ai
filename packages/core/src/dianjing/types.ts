/**
 * 点睛 (dianjing) — 专业文学诊断类型定义
 *
 * "画龙点睛" — 当明镜的常规审校无法诊断问题根因时介入。
 * 关注 "为什么不好" 而非 "哪里不好"。
 *
 * 五大诊断维度：
 *   1. 叙事动力 — 推进力来源分析
 *   2. 情感真实性 — 情感转变逻辑
 *   3. 节奏问题溯源 — 拖沓的根因
 *   4. 角色声音 — 对话可辨识度
 *   5. 主题一致性 — 章节对全书主题的推进
 */

import type { AgentId } from "../agents/types.js";

// ── 引擎配置 ──────────────────────────────────────

export interface DianjingEngineConfig {
  /** 点睛使用的 agent ID */
  agentId: AgentId;
  /** 最大核心问题数（只输出最影响体验的 N 个） */
  maxCoreIssues: number;
  /** 诊断深度 */
  diagnosisDepth: "standard" | "deep";
}

export const DEFAULT_DIANJING_CONFIG: DianjingEngineConfig = {
  agentId: "dianjing",
  maxCoreIssues: 2,
  diagnosisDepth: "deep",
};

// ── 诊断输入 ──────────────────────────────────────

export interface DiagnosisInput {
  /** 章节内容 */
  content: string;
  /** 章节号 */
  chapterNumber: number;
  /** 章节标题（可选） */
  chapterTitle?: string;
  /** 明镜审校的问题摘要（为什么需要点睛介入的背景） */
  reviewSummary?: string;
  /** 角色档案摘要 */
  characterProfiles?: string;
  /** 前几章摘要（上下文） */
  previousSummary?: string;
  /** 全书主题/核心冲突简述 */
  themeDescription?: string;
}

// ── 诊断维度 ──────────────────────────────────────

export type DiagnosisDimension =
  | "narrative_drive"
  | "emotional_authenticity"
  | "pacing_root_cause"
  | "character_voice"
  | "thematic_coherence";

export const ALL_DIAGNOSIS_DIMENSIONS: DiagnosisDimension[] = [
  "narrative_drive",
  "emotional_authenticity",
  "pacing_root_cause",
  "character_voice",
  "thematic_coherence",
];

export const DIAGNOSIS_DIMENSION_LABELS: Record<DiagnosisDimension, string> = {
  narrative_drive: "叙事动力",
  emotional_authenticity: "情感真实性",
  pacing_root_cause: "节奏问题溯源",
  character_voice: "角色声音",
  thematic_coherence: "主题一致性",
};

// ── 单维度诊断结果 ──────────────────────────────────

export interface DimensionDiagnosis {
  /** 维度标识 */
  dimension: DiagnosisDimension;
  /** 维度名称 */
  label: string;
  /** 严重程度 (1-10, 10=最严重) */
  severity: number;
  /** 根因分析（不是症状描述） */
  rootCause: string;
  /** 具体改进方向（不是代写） */
  improvementDirection: string;
  /** 原文证据引用 */
  evidence?: string;
}

// ── 核心问题 ──────────────────────────────────────

export interface CoreIssue {
  /** 问题标题（简洁） */
  title: string;
  /** 影响维度 */
  dimensions: DiagnosisDimension[];
  /** 根因分析 */
  rootCause: string;
  /** 改进方向 */
  improvementDirection: string;
  /** 影响程度 (1-10) */
  impact: number;
}

// ── 完整诊断报告 ──────────────────────────────────

export interface LiteraryDiagnosis {
  /** 各维度诊断 */
  dimensionDiagnoses: DimensionDiagnosis[];
  /** 最影响体验的核心问题（按 impact 降序，最多 maxCoreIssues 个） */
  coreIssues: CoreIssue[];
  /** 诊断总结（给编辑/作者的一段话） */
  summary: string;
  /** 原始 LLM 响应（调试用） */
  rawResponse?: string;
  /** token 用量 */
  usage: { inputTokens: number; outputTokens: number };
}
