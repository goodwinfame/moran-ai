/**
 * SSE 事件类型定义 — 8 类命名事件
 *
 * 所有流式事件通过统一的 SSE endpoint 推送：GET /api/projects/:id/events
 */

import type { MemoryCategory } from "../types/index.js";

/** 预算分配信息 */
export interface SSEBudgetAllocation {
  category: MemoryCategory;
  tokens: number;
}

/** 审校问题 */
export interface ReviewIssue {
  /** 问题描述 */
  issue: string;
  /** 严重程度 */
  severity: "critical" | "major" | "minor" | "suggestion";
  /** 原文证据 */
  evidence?: string;
  /** 修改建议 */
  suggestion?: string;
  /** 期望效果 */
  expectedEffect?: string;
}

/** 审校报告 */
export interface ReviewReport {
  /** 审校轮次 */
  round: number;
  /** 是否通过 */
  passed: boolean;
  /** 综合分数 */
  score: number;
  /** Burstiness 值 */
  burstiness?: number;
  /** 问题列表 */
  issues: ReviewIssue[];
}

/** SSE 事件类型联合 — 8 种命名事件 */
export type SSEEvent =
  | { type: "context"; data: { budget: SSEBudgetAllocation[] } }
  | { type: "writing"; data: { chunk: string; wordCount: number } }
  | { type: "reviewing"; data: { round: number } }
  | { type: "review"; data: { passed: boolean; report: ReviewReport } }
  | { type: "archiving"; data: { chapterNumber: number } }
  | { type: "done"; data: { projectId: string; chapterNumber: number } }
  | { type: "error"; data: { message: string; recoverable: boolean; code?: string } }
  | { type: "heartbeat"; data: { ts: number } };

/** 提取指定事件类型的 data 类型 */
export type SSEEventData<T extends SSEEvent["type"]> = Extract<SSEEvent, { type: T }>["data"];

/** SSE 事件监听器回调 */
export type SSEListener = (event: SSEEvent) => void;

/** 取消订阅函数 */
export type Unsubscribe = () => void;
