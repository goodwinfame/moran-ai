/**
 * 书虫 (shuchong) — 普通读者评审类型定义
 *
 * 模拟真实读者的阅读体验反馈。不做技术分析，只凭阅读感受评价。
 *
 * 四大体验维度：
 *   1. 追读欲 (0-10) — 读完想不想继续看下一章
 *   2. 走神点 — 哪些地方让读者走神了
 *   3. 打动瞬间 — 哪些瞬间让读者感动/震撼
 *   4. 最佳角色 — 最有趣的角色及原因
 */

import type { AgentId } from "../agents/types.js";

// ── 引擎配置 ──────────────────────────────────────

export interface ShuchongEngineConfig {
  /** 书虫使用的 agent ID */
  agentId: AgentId;
  /** 读者类型：enthusiast（狂热读者）/ casual（休闲读者） */
  readerType: "enthusiast" | "casual";
}

export const DEFAULT_SHUCHONG_CONFIG: ShuchongEngineConfig = {
  agentId: "shuchong",
  readerType: "enthusiast",
};

// ── 评审输入 ──────────────────────────────────────

export interface ReaderReviewInput {
  /** 章节内容 */
  content: string;
  /** 章节号 */
  chapterNumber: number;
  /** 章节标题（可选） */
  chapterTitle?: string;
  /** 前几章简要摘要（帮助读者理解上下文） */
  previousSummary?: string;
  /** 风格/题材标签（影响读者期待） */
  genreTags?: string[];
}

// ── 走神点 ──────────────────────────────────────

export interface BoringSpot {
  /** 走神的段落或句子（原文引用） */
  quote: string;
  /** 为什么走神了 */
  reason: string;
}

// ── 打动瞬间 ──────────────────────────────────────

export interface TouchingMoment {
  /** 让人感动的段落或句子（原文引用） */
  quote: string;
  /** 什么感觉 */
  feeling: string;
}

// ── 最佳角色 ──────────────────────────────────────

export interface FavoriteCharacter {
  /** 角色名 */
  name: string;
  /** 为什么觉得有趣 */
  reason: string;
}

// ── 完整读者反馈 ──────────────────────────────────

export interface ReaderFeedback {
  /** 追读欲评分 (0-10) */
  readabilityScore: number;
  /** 一句话总评（口语化） */
  oneLiner: string;
  /** 走神的地方 */
  boringSpots: BoringSpot[];
  /** 打动的瞬间 */
  touchingMoments: TouchingMoment[];
  /** 最有趣的角色 */
  favoriteCharacter: FavoriteCharacter | null;
  /** 读者的碎碎念（自由发挥的读后感） */
  freeThoughts: string;
  /** 原始 LLM 响应（调试用） */
  rawResponse?: string;
  /** token 用量 */
  usage: { inputTokens: number; outputTokens: number };
}
