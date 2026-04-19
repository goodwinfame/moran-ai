/**
 * V2 SSE event type definitions
 *
 * 15 event types: 8 general + 3 chapter-specific + 3 brainstorm-specific + 1 usage
 * These are the event types sent from server to browser via Server-Sent Events.
 */

/** V2 SSE event types — 15 种 */
export type SSEEventType =
  | "text" // 墨衡流式文本
  | "tool_call" // Agent 调用 MCP 工具
  | "tool_result" // MCP 工具返回
  | "subtask_start" // 子 Agent 开始
  | "subtask_progress" // 子 Agent 进展
  | "subtask_end" // 子 Agent 完成
  | "error" // 错误
  | "interaction_mode" // 需要用户决策
  | "message_complete" // 消息完成（含 usage 数据）
  | "chapter.start" // 章节写作开始
  | "chapter.token" // 章节文字追加
  | "chapter.complete" // 章节写作完成
  | "brainstorm.diverge" // 脑暴发散
  | "brainstorm.converge" // 脑暴聚焦
  | "brainstorm.crystallize"; // 脑暴结晶

/** All 15 event type values as a readonly array (useful for iteration/validation) */
export const SSE_EVENT_TYPES: ReadonlyArray<SSEEventType> = [
  "text",
  "tool_call",
  "tool_result",
  "subtask_start",
  "subtask_progress",
  "subtask_end",
  "error",
  "interaction_mode",
  "message_complete",
  "chapter.start",
  "chapter.token",
  "chapter.complete",
  "brainstorm.diverge",
  "brainstorm.converge",
  "brainstorm.crystallize",
];

/** V2 SSE event envelope sent from server to browser */
export interface SSEEvent {
  /** Monotonically increasing event ID — used for Last-Event-Id reconnection */
  id: number;
  /** Event type */
  type: SSEEventType;
  /** Event payload — opaque object passed through from OpenCode */
  data: Record<string, unknown>;
  /** Unix timestamp in ms */
  timestamp: number;
}

/**
 * Active SSE connection registered with the broadcaster.
 * Each browser tab opening GET /events creates one SSEConnection.
 */
export interface SSEConnection {
  /** Unique connection identifier */
  connId: string;
  /** Async callback to write an event to the SSE stream */
  write: (event: SSEEvent) => Promise<void>;
}
