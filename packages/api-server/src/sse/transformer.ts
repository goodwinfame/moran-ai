/**
 * EventTransformer — Maps OpenCode native events to V2 SSE event format.
 *
 * OpenCode SDK (@opencode-ai/sdk) emits events via SSE. Key native event types:
 * - "message.part.updated" — multiplexed: carries text chunks, tool calls/results,
 *   step-start/finish. The `part.type` field disambiguates.
 * - "session.idle"  — session finished processing → V2 "message_complete"
 * - "session.error" — session error → V2 "error"
 *
 * Custom V2 events (chapter.*, brainstorm.*, subtask.*, interaction.mode)
 * are passed through for future MCP-tool-driven side-channel use.
 *
 * Responsibilities:
 * - Maintain a monotonically increasing event ID counter
 * - Map + transform OpenCode events to V2 SSEEventType + data format
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
 * Direct 1:1 mappings for native OpenCode events and custom V2 events.
 * `message.part.updated` is handled separately via mapPartUpdated().
 */
const DIRECT_TYPE_MAP: Record<string, SSEEventType> = {
  // ── Native OpenCode events ─────────────────────────────────────────────────
  "session.idle": "message_complete",
  "session.error": "error",

  // ── Custom V2 events (emitted via MCP tool side-effects in future) ─────────
  "subtask.start": "subtask_start",
  "subtask.progress": "subtask_progress",
  "subtask.end": "subtask_end",
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

interface MappedEvent {
  type: SSEEventType;
  data: Record<string, unknown>;
}

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
    const mapped = this.mapEvent(raw);
    if (!mapped) return null;

    this.eventCounter++;

    const sseEvent: SSEEvent = {
      id: this.eventCounter,
      type: mapped.type,
      data: mapped.data,
      timestamp: Date.now(),
    };

    // ── Usage extraction for message_complete events ───────────────────────
    if (
      mapped.type === "message_complete" &&
      this.context?.projectId &&
      this.context?.userId
    ) {
      this.recordUsageIfPresent(raw.data);
    }

    return sseEvent;
  }

  /** Current counter value — useful for tests */
  get counter(): number {
    return this.eventCounter;
  }

  // ── Private mapping logic ───────────────────────────────────────────────────

  private mapEvent(raw: OpenCodeEvent): MappedEvent | null {
    // Special handling: message.part.updated is multiplexed by part.type
    if (raw.type === "message.part.updated") {
      return this.mapPartUpdated(raw.data);
    }

    // Special handling: session.error extracts error message
    if (raw.type === "session.error") {
      return { type: "error", data: this.extractErrorData(raw.data) };
    }

    const directType = DIRECT_TYPE_MAP[raw.type];
    if (!directType) return null;

    return { type: directType, data: this.extractObject(raw.data) };
  }

  /**
   * Map `message.part.updated` events based on the nested `part.type`.
   *
   * OpenCode properties shape: { part: Part, delta?: string }
   * - part.type "text"            + delta → V2 "text" { text: delta }
   * - part.type "tool-invocation"         → V2 "tool_call" or "tool_result"
   * - part.type "step-start"              → V2 "subtask_start"
   * - part.type "step-finish"             → V2 "subtask_end"
   */
  private mapPartUpdated(data: unknown): MappedEvent | null {
    const props = data as Record<string, unknown> | null;
    if (!props) return null;

    const part = props["part"] as Record<string, unknown> | undefined;
    if (!part || typeof part["type"] !== "string") return null;

    const partType = part["type"] as string;
    const delta = props["delta"] as string | undefined;

    switch (partType) {
      case "text":
        // Only emit when there's a streaming delta chunk
        if (delta !== undefined) {
          return { type: "text", data: { text: delta } };
        }
        return null;

      case "tool-invocation": {
        const toolName = (part["toolName"] as string) ?? "";
        const state = part["state"] as string | undefined;
        if (state === "result" || part["output"] !== undefined) {
          return {
            type: "tool_result",
            data: { toolName, result: part["output"] ?? null },
          };
        }
        return {
          type: "tool_call",
          data: { toolName, input: part["input"] ?? null },
        };
      }

      case "step-start":
        return { type: "subtask_start", data: this.extractObject(data) };

      case "step-finish":
        return { type: "subtask_end", data: this.extractObject(data) };

      default:
        return null;
    }
  }

  private extractErrorData(data: unknown): Record<string, unknown> {
    const props = data as Record<string, unknown> | null;
    if (!props) return { message: "Unknown error" };
    const error = props["error"];
    if (typeof error === "string") return { message: error };
    if (
      error &&
      typeof error === "object" &&
      "message" in (error as Record<string, unknown>)
    ) {
      return {
        message: String((error as Record<string, unknown>)["message"]),
      };
    }
    return { message: "Unknown error", ...props };
  }

  private extractObject(data: unknown): Record<string, unknown> {
    if (data !== null && typeof data === "object" && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
    return { value: data };
  }

  private recordUsageIfPresent(data: unknown): void {
    const rawData = data as Record<string, unknown> | null;
    const usageData =
      rawData !== null && typeof rawData === "object" && "usage" in rawData
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
          projectId: this.context!.projectId!,
          userId: this.context!.userId!,
          sessionId: this.context?.sessionId,
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
}
