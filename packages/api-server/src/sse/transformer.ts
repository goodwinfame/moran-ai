/**
 * EventTransformer — Maps OpenCode native events to V2 SSE event format.
 *
 * Responsibilities:
 * - Maintain a monotonically increasing event ID counter
 * - Map OpenCode event type strings to V2 SSEEventType
 * - Pass event data through as-is (no schema enforcement)
 * - Return null for unknown/unmapped event types
 */

import type { OpenCodeEvent } from "../opencode/manager.js";
import type { SSEEvent, SSEEventType } from "./types.js";

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

    return {
      id: this.eventCounter,
      type: mappedType,
      data,
      timestamp: Date.now(),
    };
  }

  /** Current counter value — useful for tests */
  get counter(): number {
    return this.eventCounter;
  }
}
