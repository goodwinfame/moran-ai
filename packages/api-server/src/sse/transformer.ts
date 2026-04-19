/**
 * EventTransformer — Maps OpenCode native events to V2 SSE event format.
 *
 * Responsibilities:
 * - Maintain a monotonically increasing event ID counter
 * - Map OpenCode event type strings to V2 SSEEventType
 * - Pass event data through as-is (no schema enforcement)
 * - Return null for unknown/unmapped event types
 * - Extract usage data from message_complete events and record asynchronously
 */

import type { OpenCodeEvent } from "../opencode/manager.js";
import type { SSEEvent, SSEEventType } from "./types.js";
import { costService } from "@moran/core/services";

/**
 * Optional context passed to EventTransformer for usage tracking.
 */
export interface EventTransformerContext {
  projectId?: string;
  userId?: string;
  sessionId?: string;
}

/**
 * Maps OpenCode payload type strings to V2 SSE event types.
 *
 * OpenCode emits events with a `type` field derived from the SDK event stream.
 * Unknown types are intentionally not mapped — transform() returns null for them.
 */
const TYPE_MAP: Record<string, SSEEventType> = {
  // ── General chat events ────────────────────────────────────────────────────
  "session.event.part.text": "text",
  "session.event.part.tool_input": "tool_call",
  "session.event.part.tool_output": "tool_result",
  "subtask.start": "subtask_start",
  "subtask.progress": "subtask_progress",
  "subtask.end": "subtask_end",
  "session.event.error": "error",
  "interaction.mode": "interaction_mode",
  "session.event.finish": "message_complete",

  // ── Chapter writing events ─────────────────────────────────────────────────
  "chapter.start": "chapter.start",
  "chapter.token": "chapter.token",
  "chapter.complete": "chapter.complete",

  // ── Brainstorm events ──────────────────────────────────────────────────────
  "brainstorm.diverge": "brainstorm.diverge",
  "brainstorm.converge": "brainstorm.converge",
  "brainstorm.crystallize": "brainstorm.crystallize",
};

export class EventTransformer {
  private eventCounter = 0;
  private context?: EventTransformerContext;

  constructor(context?: EventTransformerContext) {
    this.context = context;
  }

  /**
   * Transform an OpenCode native event into a V2 SSE event.
   *
   * @param raw - OpenCode event with type string and unknown data
   * @returns Transformed SSEEvent, or null if the type is unknown/unmapped
   */
  transform(raw: OpenCodeEvent): SSEEvent | null {
    const mappedType = TYPE_MAP[raw.type];
    if (!mappedType) {
      return null;
    }

    this.eventCounter++;

    const data =
      raw.data !== null &&
      typeof raw.data === "object" &&
      !Array.isArray(raw.data)
        ? (raw.data as Record<string, unknown>)
        : { value: raw.data };

    const sseEvent: SSEEvent = {
      id: this.eventCounter,
      type: mappedType,
      data,
      timestamp: Date.now(),
    };

    // ── Usage extraction for message_complete events ───────────────────────
    if (
      mappedType === "message_complete" &&
      this.context?.projectId &&
      this.context?.userId
    ) {
      const rawData = raw.data as Record<string, unknown> | null;
      const usageData =
        rawData !== null &&
        typeof rawData === "object" &&
        "usage" in rawData
          ? (rawData.usage as Record<string, unknown>)
          : null;

      if (usageData !== null && typeof usageData.promptTokens === "number") {
        const agentName =
          rawData !== null &&
          typeof rawData === "object" &&
          "agentName" in rawData
            ? String(rawData.agentName)
            : "unknown";

        void costService
          .recordUsage({
            projectId: this.context.projectId,
            userId: this.context.userId,
            sessionId: this.context.sessionId,
            model: String(usageData.model ?? "unknown"),
            promptTokens: Number(usageData.promptTokens ?? 0),
            completionTokens: Number(usageData.completionTokens ?? 0),
            agentName,
          })
          .catch(() => {
            // Silent failure — usage tracking must never break the event stream
          });
      }
    }

    return sseEvent;
  }

  /** Current counter value — useful for tests */
  get counter(): number {
    return this.eventCounter;
  }
}
