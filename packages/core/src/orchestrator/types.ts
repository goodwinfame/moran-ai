/**
 * Orchestrator 类型定义 — 墨衡编排器的接口和相关类型
 */

import type { AgentId } from "../agents/types.js";

/** 编排阶段 */
export type OrchestratorPhase =
  | "idle"
  | "brainstorming"      // Phase 1: 灵感碰撞
  | "world_building"     // Phase 2: 世界设计
  | "character_structure" // Phase 3: 角色与结构
  | "writing"            // Phase 4: 章节写作
  | "reviewing"          // Phase 5: 多维审校
  | "archiving";         // Phase 6: 归档

/** 编排器状态 */
export interface OrchestratorState {
  /** 当前阶段 */
  phase: OrchestratorPhase;
  /** 当前项目 ID */
  projectId: string;
  /** 当前章节号 */
  currentChapter: number;
  /** 当前弧段号 */
  currentArc: number;
  /** 审校轮次（Phase 5 时有效）*/
  reviewRound: number;
  /** 是否暂停 */
  paused: boolean;
  /** 是否中止 */
  aborted: boolean;
  /** 最后活跃时间 */
  lastActivity: Date;
}

/** 成本追踪记录 */
export interface CostRecord {
  /** Agent ID */
  agentId: AgentId;
  /** 阶段 */
  phase: OrchestratorPhase;
  /** 输入 token 数 */
  inputTokens: number;
  /** 输出 token 数 */
  outputTokens: number;
  /** 预估费用（美元）*/
  estimatedCost: number;
  /** 记录时间 */
  timestamp: Date;
}

/** 章节成本汇总 */
export interface ChapterCostSummary {
  chapterNumber: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEstimatedCost: number;
  byAgent: Record<string, { inputTokens: number; outputTokens: number; estimatedCost: number }>;
  byPhase: Record<string, { inputTokens: number; outputTokens: number; estimatedCost: number }>;
}

/** 写章节请求 */
export interface WriteChapterRequest {
  projectId: string;
  /** 如果不指定则自动取下一章 */
  chapterNumber?: number;
  /** 是否使用多版本择优 */
  multiVersion?: boolean;
}

/** 写章节结果 */
export interface WriteChapterResult {
  success: boolean;
  chapterNumber: number;
  /** 生成的章节内容 */
  content?: string;
  /** 审校轮次数 */
  reviewRounds: number;
  /** 是否被螺旋检测中断 */
  spiralInterrupted: boolean;
  /** 成本汇总 */
  cost: ChapterCostSummary;
  /** 错误信息 */
  error?: string;
}

/** 编排器配置 */
export interface OrchestratorConfig {
  /** 最大审校轮次 */
  maxReviewRounds: number;
  /** 弧段边界是否暂停 */
  arcBoundaryPause: boolean;
  /** 是否启用成本追踪 */
  costTracking: boolean;
  /** 心跳间隔（毫秒）*/
  heartbeatInterval: number;
}

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  maxReviewRounds: 3,
  arcBoundaryPause: true,
  costTracking: true,
  heartbeatInterval: 30_000,
};
