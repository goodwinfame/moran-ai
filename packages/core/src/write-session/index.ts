/**
 * write-session 模块导出
 *
 * M2.6: 多章连续写作 — write-next / write-loop / 弧段边界 / 恢复机制
 */

// Types
export type {
  WriteNextRequest,
  WriteNextResult,
  WriteLoopRequest,
  WriteLoopResult,
  WriteLoopStats,
  WriteLoopStopReason,
  ArcBoundaryAction,
  ArcBoundaryInfo,
  WriteSessionState,
  WriteSessionStatus,
  WriteSessionEvent,
  WriteSessionListener,
  ProjectDataProvider,
} from "./types.js";

// Classes
export { WriteSession } from "./write-session.js";
export { InMemoryDataProvider } from "./in-memory-data-provider.js";
