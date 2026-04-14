/**
 * 灵犀 (LingxiEngine) — 类型定义
 *
 * §4.3.2 灵犀 — 创意脑暴
 *
 * 四阶段创意流程：
 *   1. 发散：生成 5+ 个差异化概念方案
 *   2. 推演：What-if 极端推演
 *   3. 聚焦：收敛至 2-3 个最佳方案
 *   4. 结晶：输出结构化创意简报
 */

// ── 概念方案 ──────────────────────────────────────────

/** 单个概念方案 */
export interface ConceptProposal {
  /** 方案名称 */
  name: string;
  /** 前提设定 */
  premise: string;
  /** What-if 极端推演结果 */
  whatIf: string;
  /** 潜在风险 */
  risk: string;
  /** 独特卖点 */
  uniqueHook: string;
}

// ── 创意简报 ──────────────────────────────────────────

/** 创意简报 — 灵犀的最终产出 */
export interface CreativeBrief {
  /** 书名候选（3-5个） */
  titleCandidates: string[];
  /** 主类型 / 子类型 */
  genre: string;
  /** 一句话梗概（≤25字） */
  logline: string;
  /** 核心冲突 */
  coreConflict: string;
  /** 独特卖点 */
  uniqueHook: string;
  /** 整体基调描述 */
  tone: string;
  /** 目标读者画像 */
  targetAudience: string;
  /** 预估篇幅/章节数 */
  estimatedScale: string;
  /** 最终选中的概念方案（2-3个） */
  selectedConcepts: ConceptProposal[];
}

// ── 输入/输出 ──────────────────────────────────────────

/** 脑暴输入 */
export interface BrainstormInput {
  /** 项目 ID */
  projectId: string;
  /** 题材/灵感关键词 */
  keywords: string[];
  /** 用户偏好描述（可选） */
  preferences?: string;
  /** 参考析典沉淀知识（可选） */
  referenceKnowledge?: string[];
  /** 用户指定的类型约束（可选） */
  genreConstraint?: string;
}

/** 发散阶段结果 */
export interface DivergenceResult {
  /** 生成的概念方案（5+） */
  concepts: ConceptProposal[];
  /** 原始 LLM 输出 */
  rawOutput: string;
}

/** 聚焦阶段结果 */
export interface ConvergenceResult {
  /** 筛选后的方案（2-3） */
  selectedConcepts: ConceptProposal[];
  /** 筛选理由 */
  selectionReasoning: string;
  /** 原始 LLM 输出 */
  rawOutput: string;
}

/** 完整脑暴结果 */
export interface BrainstormResult {
  /** 创意简报 */
  brief: CreativeBrief;
  /** 发散阶段原始概念数 */
  totalConceptsGenerated: number;
  /** 最终选中方案数 */
  selectedCount: number;
  /** Token 消耗 */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ── 引擎配置 ──────────────────────────────────────────

/** 灵犀引擎配置 */
export interface LingxiEngineConfig {
  /** 发散阶段最少方案数 */
  minConcepts: number;
  /** 聚焦后保留方案数 */
  finalCandidates: number;
  /** 是否启用 What-if 推演 */
  enableWhatIf: boolean;
}

export const DEFAULT_LINGXI_CONFIG: LingxiEngineConfig = {
  minConcepts: 5,
  finalCandidates: 3,
  enableWhatIf: true,
};
