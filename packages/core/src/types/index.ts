/**
 * 共享类型定义
 */

/** 项目状态 */
export type ProjectStatus = "active" | "paused" | "completed" | "archived";

/** 章节状态 */
export type ChapterStatus = "draft" | "reviewing" | "approved" | "archived";

/** 伏笔状态 */
export type PlotThreadStatus = "planted" | "developing" | "resolved" | "stale";

/** MemorySlice 类别 */
export type MemoryCategory =
  | "guidance"
  | "world"
  | "characters"
  | "consistency"
  | "summaries"
  | "outline";

/** MemorySlice 存储层级 */
export type MemoryTier = "hot" | "warm" | "cold";

/** MemorySlice 稳定性 */
export type MemoryStability =
  | "immutable"
  | "canon"
  | "evolving"
  | "ephemeral";

/** MemorySlice 作用域 */
export type MemoryScope = "global" | "arc" | "chapter";

/** SSE 事件类型 */
export type SSEEventType =
  | "context"
  | "writing"
  | "reviewing"
  | "review"
  | "archiving"
  | "done"
  | "error"
  | "heartbeat";
