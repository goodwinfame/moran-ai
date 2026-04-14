/**
 * WriteSession — 多章连续写作类型定义
 *
 * M2.6: write-next / write-loop / 弧段边界检测 / 恢复机制
 *
 * WriteSession 是连续写作的控制层，构建在 ChapterPipeline（单章）之上。
 * 核心能力：
 *   - write-next: 确定下一章序号 → 生成 Brief → 执行 Pipeline
 *   - write-loop: 连续写 N 章，弧段边界自动暂停
 *   - 中断恢复: 任意位置中断后可从上次状态继续
 */

import type { WriteChapterResult } from "../orchestrator/types.js";

// ── write-next 请求 ──────────────────────────────────

/** write-next 命令请求 */
export interface WriteNextRequest {
  /** 项目 ID */
  projectId: string;
  /** 显式指定章节号（不指定则自动推断下一章） */
  chapterNumber?: number;
  /** 使用的风格 ID */
  styleId?: string;
  /** 是否跳过 Brief 生成（使用已有 Brief） */
  useExistingBrief?: boolean;
}

/** write-next 命令结果 */
export interface WriteNextResult extends WriteChapterResult {
  /** 弧段信息 */
  arcInfo: ArcBoundaryInfo;
  /** 是否命中弧段边界 */
  isArcBoundary: boolean;
}

// ── write-loop 请求 ──────────────────────────────────

/** write-loop 命令请求 */
export interface WriteLoopRequest {
  /** 项目 ID */
  projectId: string;
  /** 目标写作章数（不指定则写完当前弧段） */
  targetChapters?: number;
  /** 使用的风格 ID */
  styleId?: string;
  /** 弧段边界行为 */
  arcBoundaryAction: ArcBoundaryAction;
}

/** 弧段边界触发行为 */
export type ArcBoundaryAction =
  | "pause"       // 暂停等待用户确认（默认）
  | "continue"    // 自动进入下一弧段
  | "stop";       // 停止写作循环

/** write-loop 命令结果 */
export interface WriteLoopResult {
  /** 写作是否正常结束（非错误中断） */
  completed: boolean;
  /** 已写章节结果列表 */
  chapters: WriteChapterResult[];
  /** 写作停止原因 */
  stopReason: WriteLoopStopReason;
  /** 弧段边界信息（如果停止原因是弧段边界） */
  arcBoundary?: ArcBoundaryInfo;
  /** 循环统计 */
  stats: WriteLoopStats;
  /** 是否可恢复 */
  resumable: boolean;
}

/** 写作循环停止原因 */
export type WriteLoopStopReason =
  | "target_reached"    // 目标章数已达成
  | "arc_boundary"      // 弧段边界暂停
  | "spiral_interrupt"  // 审校螺旋中断
  | "user_pause"        // 用户手动暂停
  | "error"             // 运行错误
  | "no_more_chapters"; // 没有更多章节可写（弧段计划用完）

/** 写作循环统计 */
export interface WriteLoopStats {
  /** 实际完成章数 */
  chaptersWritten: number;
  /** 目标章数（如果有） */
  targetChapters?: number;
  /** 总字数 */
  totalWordCount: number;
  /** 审校通过率（首次通过/总章数） */
  firstPassRate: number;
  /** 总花费（估算） */
  totalEstimatedCost: number;
  /** 开始时间 */
  startedAt: Date;
  /** 结束时间 */
  endedAt: Date;
  /** 总耗时（秒） */
  durationSeconds: number;
}

// ── 弧段边界 ──────────────────────────────────────────

/** 弧段边界信息 */
export interface ArcBoundaryInfo {
  /** 当前弧段号 */
  currentArc: number;
  /** 当前弧段名 */
  currentArcName?: string;
  /** 当前章节在弧段内的位置 (1-based) */
  positionInArc: number;
  /** 当前弧段总章数 */
  arcTotalChapters: number;
  /** 是否为弧段最后一章 */
  isLastInArc: boolean;
  /** 下一弧段号（如果存在） */
  nextArc?: number;
  /** 下一弧段名（如果存在） */
  nextArcName?: string;
}

// ── WriteSession 状态（可序列化，用于恢复） ──────────

/** WriteSession 持久化状态 */
export interface WriteSessionState {
  /** 会话 ID */
  sessionId: string;
  /** 项目 ID */
  projectId: string;
  /** 会话类型 */
  type: "write-next" | "write-loop";
  /** 当前状态 */
  status: WriteSessionStatus;
  /** 当前弧段号 */
  currentArc: number;
  /** 下一个要写的章节号 */
  nextChapter: number;
  /** 已完成的章节号列表 */
  completedChapters: number[];
  /** 目标章数（write-loop 模式） */
  targetChapters?: number;
  /** 弧段边界行为 */
  arcBoundaryAction: ArcBoundaryAction;
  /** 使用的风格 ID */
  styleId?: string;
  /** 循环统计 */
  stats: {
    chaptersWritten: number;
    totalWordCount: number;
    firstPassCount: number;
    totalEstimatedCost: number;
    startedAt: string; // ISO string for serialization
  };
  /** 停止原因（如果已暂停/停止） */
  stopReason?: WriteLoopStopReason;
  /** 错误信息 */
  error?: string;
  /** 创建时间 */
  createdAt: string;
  /** 最后更新时间 */
  updatedAt: string;
}

/** WriteSession 状态枚举 */
export type WriteSessionStatus =
  | "idle"           // 未开始
  | "running"        // 正在写作
  | "paused"         // 暂停（弧段边界或用户）
  | "completed"      // 正常完成
  | "error"          // 错误停止
  | "interrupted";   // 螺旋中断

// ── 数据查询接口（由调用方注入） ──────────────────────

/** 项目数据查询器 — 抽象数据访问，避免直接依赖 DB */
export interface ProjectDataProvider {
  /** 获取项目的当前已完成章节号（最大值） */
  getLastCompletedChapter(projectId: string): Promise<number>;
  /** 获取项目的当前弧段信息 */
  getCurrentArc(projectId: string): Promise<{
    arcNumber: number;
    arcName?: string;
    startChapter: number;
    endChapter: number;
    totalChapters: number;
  } | null>;
  /** 获取下一个弧段信息 */
  getNextArc(projectId: string, currentArcNumber: number): Promise<{
    arcNumber: number;
    arcName?: string;
    startChapter: number;
    endChapter: number;
    totalChapters: number;
  } | null>;
  /** 获取章节 Brief（如果已生成） */
  getChapterBrief(projectId: string, chapterNumber: number): Promise<string | null>;
  /** 获取章节已有内容（恢复用） */
  getChapterContent(projectId: string, chapterNumber: number): Promise<string | null>;
  /** 更新项目的 currentChapter */
  updateProjectProgress(projectId: string, currentChapter: number, currentArc: number): Promise<void>;
  /** 保存 WriteSession 状态 */
  saveSessionState(state: WriteSessionState): Promise<void>;
  /** 加载 WriteSession 状态 */
  loadSessionState(projectId: string): Promise<WriteSessionState | null>;
}

// ── 事件回调 ──────────────────────────────────────────

/** WriteSession 事件 */
export type WriteSessionEvent =
  | { type: "chapter_start"; chapterNumber: number; arcNumber: number }
  | { type: "chapter_complete"; chapterNumber: number; result: WriteChapterResult }
  | { type: "arc_boundary"; info: ArcBoundaryInfo }
  | { type: "loop_progress"; stats: WriteLoopStats; nextChapter: number }
  | { type: "session_paused"; reason: WriteLoopStopReason }
  | { type: "session_completed"; result: WriteLoopResult }
  | { type: "session_error"; error: string };

/** WriteSession 事件监听器 */
export type WriteSessionListener = (event: WriteSessionEvent) => void;
