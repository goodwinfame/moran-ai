/**
 * SSE module — public exports
 *
 * Provides the server-side SSE infrastructure:
 * - V2 event type definitions (14 types)
 * - EventTransformer: OpenCode events → V2 SSE events
 * - SSEBroadcaster: connection management + ring buffer + replay
 */

export type { SSEEvent, SSEEventType, SSEConnection } from "./types.js";
export { SSE_EVENT_TYPES } from "./types.js";
export { EventTransformer } from "./transformer.js";
export { SSEBroadcaster, broadcaster } from "./broadcaster.js";
export type { AgentStatus } from "./agent-state-tracker.js";
export { AgentStateTracker, agentStateTracker } from "./agent-state-tracker.js";
