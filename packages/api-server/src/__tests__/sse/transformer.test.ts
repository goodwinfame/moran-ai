/**
 * EventTransformer — Unit Tests
 *
 * Verifies all V2 SSE event mappings, unknown type handling,
 * counter monotonicity, usage extraction, and data transformation.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock costService before importing transformer ─────────────────────────────

const mockRecordUsage = vi.fn();
vi.mock("@moran/core/services", () => ({
  costService: {
    recordUsage: (...args: unknown[]) => mockRecordUsage(...args),
  },
}));

import { EventTransformer } from "../../sse/transformer.js";
import type { OpenCodeEvent } from "../../opencode/manager.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRaw(type: string, data: unknown = {}): OpenCodeEvent {
  return { type, data };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("EventTransformer", () => {
  let transformer: EventTransformer;

  beforeEach(() => {
    transformer = new EventTransformer();
    vi.clearAllMocks();
  });

  // ── message.part.updated — text events ────────────────────────────────────

  describe("message.part.updated — text events", () => {
    it("maps text part with delta → 'text' with { text: delta }", () => {
      const result = transformer.transform(
        makeRaw("message.part.updated", {
          part: { type: "text" },
          delta: "hello world",
        }),
      );
      expect(result).not.toBeNull();
      expect(result?.type).toBe("text");
      expect(result?.data).toEqual({ text: "hello world" });
    });

    it("returns null for text part without delta", () => {
      const result = transformer.transform(
        makeRaw("message.part.updated", {
          part: { type: "text" },
        }),
      );
      expect(result).toBeNull();
    });

    it("returns null when part field is missing", () => {
      const result = transformer.transform(
        makeRaw("message.part.updated", { delta: "some text" }),
      );
      expect(result).toBeNull();
    });

    it("returns null when part.type is missing", () => {
      const result = transformer.transform(
        makeRaw("message.part.updated", {
          part: { toolName: "something" },
          delta: "text",
        }),
      );
      expect(result).toBeNull();
    });

    it("returns null when data is null", () => {
      const result = transformer.transform(makeRaw("message.part.updated", null));
      expect(result).toBeNull();
    });
  });

  // ── message.part.updated — tool-invocation events ─────────────────────────

  describe("message.part.updated — tool-invocation events", () => {
    it("maps tool invocation without state/output → 'tool_call' with { toolName, input }", () => {
      const result = transformer.transform(
        makeRaw("message.part.updated", {
          part: {
            type: "tool-invocation",
            toolName: "world_create",
            input: { name: "Azeroth" },
          },
        }),
      );
      expect(result).not.toBeNull();
      expect(result?.type).toBe("tool_call");
      expect(result?.data).toEqual({ toolName: "world_create", input: { name: "Azeroth" } });
    });

    it("maps tool invocation with state='result' → 'tool_result' with { toolName, result }", () => {
      const result = transformer.transform(
        makeRaw("message.part.updated", {
          part: {
            type: "tool-invocation",
            toolName: "world_create",
            state: "result",
            output: { id: "world-1" },
          },
        }),
      );
      expect(result).not.toBeNull();
      expect(result?.type).toBe("tool_result");
      expect(result?.data).toEqual({ toolName: "world_create", result: { id: "world-1" } });
    });

    it("maps tool invocation with output present → 'tool_result'", () => {
      const result = transformer.transform(
        makeRaw("message.part.updated", {
          part: {
            type: "tool-invocation",
            toolName: "chapter_write",
            output: "Chapter written successfully",
          },
        }),
      );
      expect(result).not.toBeNull();
      expect(result?.type).toBe("tool_result");
      expect(result?.data).toEqual({ toolName: "chapter_write", result: "Chapter written successfully" });
    });

    it("uses null for missing input in tool_call", () => {
      const result = transformer.transform(
        makeRaw("message.part.updated", {
          part: { type: "tool-invocation", toolName: "no_input_tool" },
        }),
      );
      expect(result?.type).toBe("tool_call");
      expect(result?.data).toEqual({ toolName: "no_input_tool", input: null });
    });

    it("uses null for missing output in tool_result", () => {
      const result = transformer.transform(
        makeRaw("message.part.updated", {
          part: { type: "tool-invocation", toolName: "some_tool", state: "result" },
        }),
      );
      expect(result?.type).toBe("tool_result");
      expect(result?.data).toEqual({ toolName: "some_tool", result: null });
    });
  });

  // ── message.part.updated — step events ───────────────────────────────────

  describe("message.part.updated — step events", () => {
    it("maps step-start → 'subtask_start'", () => {
      const data = { part: { type: "step-start" }, stepId: "s1" };
      const result = transformer.transform(makeRaw("message.part.updated", data));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("subtask_start");
      expect(result?.data).toEqual(data);
    });

    it("maps step-finish → 'subtask_end'", () => {
      const data = { part: { type: "step-finish" }, stepId: "s1", duration: 200 };
      const result = transformer.transform(makeRaw("message.part.updated", data));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("subtask_end");
      expect(result?.data).toEqual(data);
    });
  });

  // ── message.part.updated — unknown part type ─────────────────────────────

  describe("message.part.updated — unknown part type", () => {
    it("returns null for unknown part.type 'reasoning'", () => {
      const result = transformer.transform(
        makeRaw("message.part.updated", { part: { type: "reasoning" }, text: "thinking..." }),
      );
      expect(result).toBeNull();
    });

    it("returns null for unknown part.type 'image'", () => {
      const result = transformer.transform(
        makeRaw("message.part.updated", { part: { type: "image" }, url: "http://..." }),
      );
      expect(result).toBeNull();
    });
  });

  // ── session.idle → message_complete ──────────────────────────────────────

  describe("session.idle → message_complete", () => {
    it("maps session.idle → 'message_complete'", () => {
      const result = transformer.transform(makeRaw("session.idle", { sessionId: "sess-1" }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("message_complete");
    });

    it("passes through object data", () => {
      const data = { sessionId: "sess-1", duration: 3000 };
      const result = transformer.transform(makeRaw("session.idle", data));
      expect(result?.data).toEqual(data);
    });
  });

  // ── session.error → error ─────────────────────────────────────────────────

  describe("session.error → error", () => {
    it("extracts string error field: { error: 'msg' } → { message: 'msg' }", () => {
      const result = transformer.transform(
        makeRaw("session.error", { error: "Something went wrong" }),
      );
      expect(result).not.toBeNull();
      expect(result?.type).toBe("error");
      expect(result?.data).toEqual({ message: "Something went wrong" });
    });

    it("extracts nested error: { error: { message: 'msg' } } → { message: 'msg' }", () => {
      const result = transformer.transform(
        makeRaw("session.error", { error: { message: "Nested error message" } }),
      );
      expect(result).not.toBeNull();
      expect(result?.type).toBe("error");
      expect(result?.data).toEqual({ message: "Nested error message" });
    });

    it("falls back to 'Unknown error' when no error field", () => {
      const result = transformer.transform(makeRaw("session.error", { foo: "bar" }));
      expect(result?.type).toBe("error");
      expect(result?.data).toMatchObject({ message: "Unknown error" });
    });

    it("falls back to 'Unknown error' when data is null", () => {
      const result = transformer.transform(makeRaw("session.error", null));
      expect(result?.type).toBe("error");
      expect(result?.data).toEqual({ message: "Unknown error" });
    });
  });

  // ── Direct passthrough events ─────────────────────────────────────────────

  describe("direct passthrough events", () => {
    it("maps subtask.start → subtask_start", () => {
      const result = transformer.transform(makeRaw("subtask.start", { agentId: "jiangxin" }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("subtask_start");
    });

    it("maps subtask.progress → subtask_progress", () => {
      const result = transformer.transform(makeRaw("subtask.progress", { description: "writing..." }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("subtask_progress");
    });

    it("maps subtask.end → subtask_end", () => {
      const result = transformer.transform(makeRaw("subtask.end", { agentId: "jiangxin" }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("subtask_end");
    });

    it("maps interaction.mode → interaction_mode", () => {
      const result = transformer.transform(makeRaw("interaction.mode", { question: "继续？" }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("interaction_mode");
    });

    it("maps chapter.start → chapter.start", () => {
      const result = transformer.transform(makeRaw("chapter.start", { chapterNumber: 1 }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("chapter.start");
    });

    it("maps chapter.token → chapter.token", () => {
      const result = transformer.transform(makeRaw("chapter.token", { token: "天空", wordCount: 100 }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("chapter.token");
    });

    it("maps chapter.complete → chapter.complete", () => {
      const result = transformer.transform(makeRaw("chapter.complete", { wordCount: 3000 }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("chapter.complete");
    });

    it("maps brainstorm.diverge → brainstorm.diverge", () => {
      const result = transformer.transform(makeRaw("brainstorm.diverge", { ideas: ["a", "b"] }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("brainstorm.diverge");
    });

    it("maps brainstorm.converge → brainstorm.converge", () => {
      const result = transformer.transform(makeRaw("brainstorm.converge", { focus: "主题一" }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("brainstorm.converge");
    });

    it("maps brainstorm.crystallize → brainstorm.crystallize", () => {
      const result = transformer.transform(makeRaw("brainstorm.crystallize", { crystal: {} }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("brainstorm.crystallize");
    });

    it("passes object data through unchanged for passthrough events", () => {
      const data = { chapterNumber: 3, title: "第三章", wordCount: 5000 };
      const result = transformer.transform(makeRaw("chapter.complete", data));
      expect(result?.data).toEqual(data);
    });
  });

  // ── Unknown event types ────────────────────────────────────────────────────

  describe("unknown event types", () => {
    it("returns null for completely unknown type", () => {
      const result = transformer.transform(makeRaw("unknown.event.type"));
      expect(result).toBeNull();
    });

    it("returns null for empty string type", () => {
      const result = transformer.transform(makeRaw(""));
      expect(result).toBeNull();
    });

    it("returns null for partial match that doesn't map", () => {
      const result = transformer.transform(makeRaw("chapter"));
      expect(result).toBeNull();
    });

    it("returns null for old event type 'session.event.part.text'", () => {
      const result = transformer.transform(makeRaw("session.event.part.text"));
      expect(result).toBeNull();
    });

    it("returns null for old event type 'session.event.finish'", () => {
      const result = transformer.transform(makeRaw("session.event.finish"));
      expect(result).toBeNull();
    });

    it("does NOT increment counter for unknown types", () => {
      transformer.transform(makeRaw("unknown.a"));
      transformer.transform(makeRaw("unknown.b"));
      expect(transformer.counter).toBe(0);
    });

    it("does NOT increment counter for message.part.updated with no delta (text)", () => {
      transformer.transform(
        makeRaw("message.part.updated", { part: { type: "text" } }),
      );
      expect(transformer.counter).toBe(0);
    });
  });

  // ── Counter monotonicity ───────────────────────────────────────────────────

  describe("counter", () => {
    it("starts at 0", () => {
      expect(transformer.counter).toBe(0);
    });

    it("increments monotonically for each successful transform", () => {
      const e1 = transformer.transform(
        makeRaw("message.part.updated", { part: { type: "text" }, delta: "hi" }),
      );
      const e2 = transformer.transform(makeRaw("subtask.start", { agentId: "a" }));
      const e3 = transformer.transform(makeRaw("chapter.token", { token: "字" }));

      expect(e1?.id).toBe(1);
      expect(e2?.id).toBe(2);
      expect(e3?.id).toBe(3);
      expect(transformer.counter).toBe(3);
    });

    it("skips counter for unknown types between known ones", () => {
      const e1 = transformer.transform(
        makeRaw("message.part.updated", { part: { type: "text" }, delta: "hello" }),
      );
      transformer.transform(makeRaw("unknown.type")); // should not increment
      const e2 = transformer.transform(makeRaw("subtask.start", {}));

      expect(e1?.id).toBe(1);
      expect(e2?.id).toBe(2);
    });

    it("skips counter for null-returning message.part.updated (no delta)", () => {
      const e1 = transformer.transform(
        makeRaw("message.part.updated", { part: { type: "text" }, delta: "chunk" }),
      );
      transformer.transform(makeRaw("message.part.updated", { part: { type: "text" } }));
      const e2 = transformer.transform(makeRaw("session.idle", {}));

      expect(e1?.id).toBe(1);
      expect(e2?.id).toBe(2);
    });
  });

  // ── Data passthrough ───────────────────────────────────────────────────────

  describe("data passthrough", () => {
    it("passes object data through unchanged for passthrough events", () => {
      const data = { agentId: "zaishi", description: "archiving...", nested: { x: 1 } };
      const result = transformer.transform(makeRaw("subtask.start", data));
      expect(result?.data).toEqual(data);
    });

    it("wraps non-object string data in { value } envelope", () => {
      const result = transformer.transform({ type: "subtask.start", data: "string-value" });
      expect(result?.data).toEqual({ value: "string-value" });
    });

    it("wraps null data in { value } envelope", () => {
      const result = transformer.transform({ type: "subtask.start", data: null });
      expect(result?.data).toEqual({ value: null });
    });

    it("wraps array data in { value } envelope", () => {
      const result = transformer.transform({ type: "subtask.start", data: [1, 2, 3] });
      expect(result?.data).toEqual({ value: [1, 2, 3] });
    });

    it("text event data is { text: delta }, not the raw data object", () => {
      const result = transformer.transform(
        makeRaw("message.part.updated", {
          part: { type: "text" },
          delta: "streaming chunk",
          extraField: "ignored",
        }),
      );
      expect(result?.data).toEqual({ text: "streaming chunk" });
    });
  });

  // ── Timestamp ─────────────────────────────────────────────────────────────

  describe("timestamp", () => {
    it("sets timestamp close to Date.now()", () => {
      const before = Date.now();
      const result = transformer.transform(
        makeRaw("message.part.updated", { part: { type: "text" }, delta: "hi" }),
      );
      const after = Date.now();
      expect(result?.timestamp).toBeGreaterThanOrEqual(before);
      expect(result?.timestamp).toBeLessThanOrEqual(after);
    });
  });

  // ── message_complete (usage event) ────────────────────────────────────────

  describe("message_complete event", () => {
    it("maps session.idle → message_complete", () => {
      const result = transformer.transform(makeRaw("session.idle", {}));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("message_complete");
    });

    it("does NOT call recordUsage when no context is set", async () => {
      mockRecordUsage.mockResolvedValue({ ok: true, data: { id: "rec-1" } });

      transformer.transform(
        makeRaw("session.idle", {
          usage: { promptTokens: 1000, completionTokens: 500, model: "claude-sonnet-4" },
        }),
      );

      await Promise.resolve(); // flush microtasks
      expect(mockRecordUsage).not.toHaveBeenCalled();
    });

    it("calls recordUsage fire-and-forget when context and usage data present", async () => {
      mockRecordUsage.mockResolvedValue({ ok: true, data: { id: "rec-1" } });

      const ctx = { projectId: "proj-1", userId: "user-1", sessionId: "sess-abc" };
      const txfm = new EventTransformer(ctx);

      txfm.transform(
        makeRaw("session.idle", {
          agentName: "moheng",
          usage: { promptTokens: 1000, completionTokens: 500, model: "claude-sonnet-4" },
        }),
      );

      // Allow async side-effect to settle
      await new Promise((r) => setTimeout(r, 0));

      expect(mockRecordUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "proj-1",
          userId: "user-1",
          sessionId: "sess-abc",
          promptTokens: 1000,
          completionTokens: 500,
          model: "claude-sonnet-4",
          agentName: "moheng",
        }),
      );
    });

    it("does NOT call recordUsage when usage has no promptTokens", async () => {
      mockRecordUsage.mockResolvedValue({ ok: true, data: { id: "rec-1" } });

      const ctx = { projectId: "proj-1", userId: "user-1" };
      const txfm = new EventTransformer(ctx);

      txfm.transform(makeRaw("session.idle", { usage: { model: "claude-sonnet-4" } }));

      await new Promise((r) => setTimeout(r, 0));
      expect(mockRecordUsage).not.toHaveBeenCalled();
    });

    it("silently ignores recordUsage failures (fire-and-forget)", async () => {
      mockRecordUsage.mockRejectedValue(new Error("DB down"));

      const ctx = { projectId: "proj-1", userId: "user-1" };
      const txfm = new EventTransformer(ctx);

      // Should not throw
      expect(() => {
        txfm.transform(
          makeRaw("session.idle", {
            usage: { promptTokens: 100, completionTokens: 50, model: "gpt-4o" },
          }),
        );
      }).not.toThrow();

      await new Promise((r) => setTimeout(r, 0));
      // No unhandled rejection — test passes if we reach here
    });

    it("does NOT call recordUsage for non-message_complete events", async () => {
      mockRecordUsage.mockResolvedValue({ ok: true, data: { id: "rec-1" } });

      const ctx = { projectId: "proj-1", userId: "user-1" };
      const txfm = new EventTransformer(ctx);

      txfm.transform(
        makeRaw("subtask.start", {
          usage: { promptTokens: 100, completionTokens: 50 },
        }),
      );

      await new Promise((r) => setTimeout(r, 0));
      expect(mockRecordUsage).not.toHaveBeenCalled();
    });

    it("does NOT call recordUsage for tool_call events even with usage data", async () => {
      mockRecordUsage.mockResolvedValue({ ok: true, data: { id: "rec-1" } });

      const ctx = { projectId: "proj-1", userId: "user-1" };
      const txfm = new EventTransformer(ctx);

      txfm.transform(
        makeRaw("message.part.updated", {
          part: { type: "tool-invocation", toolName: "test_tool" },
          usage: { promptTokens: 100, completionTokens: 50 },
        }),
      );

      await new Promise((r) => setTimeout(r, 0));
      expect(mockRecordUsage).not.toHaveBeenCalled();
    });
  });
});
