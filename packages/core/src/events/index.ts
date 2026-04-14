/**
 * Events 模块 — 导出 SSE 事件类型、EventBus 和 EventBuffer
 */

export type {
  SSEBudgetAllocation,
  ReviewIssue,
  ReviewReport,
  SSEEvent,
  SSEEventData,
  SSEListener,
  Unsubscribe,
} from "./types.js";

export { EventBus } from "./event-bus.js";
export type { SSEListenerWithId } from "./event-bus.js";
export { EventBuffer } from "./event-buffer.js";
export type { BufferedEvent } from "./event-buffer.js";
