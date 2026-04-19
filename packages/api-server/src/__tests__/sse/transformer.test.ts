/**
 * EventTransformer — Unit Tests
 *
 * Verifies all 14 V2 SSE event type mappings, unknown type handling,
 * and counter monotonicity.
 */
import { describe, it, expect, beforeEach } from "vitest";
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
  });

  // ── General chat events (8 types) ─────────────────────────────────────────

  describe("text event", () => {
    it("maps session.event.part.text → text", () => {
      const result = transformer.transform(makeRaw("session.event.part.text", { chunk: "hello" }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("text");
    });
  });

  describe("tool_call event", () => {
    it("maps session.event.part.tool_input → tool_call", () => {
      const result = transformer.transform(makeRaw("session.event.part.tool_input", { toolName: "world_create" }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("tool_call");
    });
  });

  describe("tool_result event", () => {
    it("maps session.event.part.tool_output → tool_result", () => {
      const result = transformer.transform(makeRaw("session.event.part.tool_output", { result: "ok" }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("tool_result");
    });
  });

  describe("subtask_start event", () => {
    it("maps subtask.start → subtask_start", () => {
      const result = transformer.transform(makeRaw("subtask.start", { agentId: "zhibi" }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("subtask_start");
    });
  });

  describe("subtask_progress event", () => {
    it("maps subtask.progress → subtask_progress", () => {
      const result = transformer.transform(makeRaw("subtask.progress", { description: "writing..." }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("subtask_progress");
    });
  });

  describe("subtask_end event", () => {
    it("maps subtask.end → subtask_end", () => {
      const result = transformer.transform(makeRaw("subtask.end", { agentId: "zhibi" }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("subtask_end");
    });
  });

  describe("error event", () => {
    it("maps session.event.error → error", () => {
      const result = transformer.transform(makeRaw("session.event.error", { message: "something failed" }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("error");
    });
  });

  describe("interaction_mode event", () => {
    it("maps interaction.mode → interaction_mode", () => {
      const result = transformer.transform(makeRaw("interaction.mode", { question: "继续？" }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("interaction_mode");
    });
  });

  // ── Chapter events (3 types) ───────────────────────────────────────────────

  describe("chapter.start event", () => {
    it("maps chapter.start → chapter.start", () => {
      const result = transformer.transform(makeRaw("chapter.start", { chapterNumber: 1 }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("chapter.start");
    });
  });

  describe("chapter.token event", () => {
    it("maps chapter.token → chapter.token", () => {
      const result = transformer.transform(makeRaw("chapter.token", { token: "天空", wordCount: 100 }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("chapter.token");
    });
  });

  describe("chapter.complete event", () => {
    it("maps chapter.complete → chapter.complete", () => {
      const result = transformer.transform(makeRaw("chapter.complete", { wordCount: 3000 }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("chapter.complete");
    });
  });

  // ── Brainstorm events (3 types) ────────────────────────────────────────────

  describe("brainstorm.diverge event", () => {
    it("maps brainstorm.diverge → brainstorm.diverge", () => {
      const result = transformer.transform(makeRaw("brainstorm.diverge", { ideas: ["a", "b"] }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("brainstorm.diverge");
    });
  });

  describe("brainstorm.converge event", () => {
    it("maps brainstorm.converge → brainstorm.converge", () => {
      const result = transformer.transform(makeRaw("brainstorm.converge", { focus: "主题一" }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("brainstorm.converge");
    });
  });

  describe("brainstorm.crystallize event", () => {
    it("maps brainstorm.crystallize → brainstorm.crystallize", () => {
      const result = transformer.transform(makeRaw("brainstorm.crystallize", { crystal: {} }));
      expect(result).not.toBeNull();
      expect(result?.type).toBe("brainstorm.crystallize");
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

    it("does NOT increment counter for unknown types", () => {
      transformer.transform(makeRaw("unknown.a"));
      transformer.transform(makeRaw("unknown.b"));
      expect(transformer.counter).toBe(0);
    });
  });

  // ── Counter monotonicity ───────────────────────────────────────────────────

  describe("counter", () => {
    it("starts at 0", () => {
      expect(transformer.counter).toBe(0);
    });

    it("increments monotonically for each successful transform", () => {
      const e1 = transformer.transform(makeRaw("session.event.part.text"));
      const e2 = transformer.transform(makeRaw("subtask.start"));
      const e3 = transformer.transform(makeRaw("chapter.token"));

      expect(e1?.id).toBe(1);
      expect(e2?.id).toBe(2);
      expect(e3?.id).toBe(3);
      expect(transformer.counter).toBe(3);
    });

    it("skips counter for unknown types between known ones", () => {
      const e1 = transformer.transform(makeRaw("session.event.part.text"));
      transformer.transform(makeRaw("unknown.type")); // should not increment
      const e2 = transformer.transform(makeRaw("subtask.start"));

      expect(e1?.id).toBe(1);
      expect(e2?.id).toBe(2);
    });
  });

  // ── Data passthrough ───────────────────────────────────────────────────────

  describe("data passthrough", () => {
    it("passes object data through unchanged", () => {
      const data = { chunk: "你好", wordCount: 42, nested: { x: 1 } };
      const result = transformer.transform(makeRaw("session.event.part.text", data));
      expect(result?.data).toEqual(data);
    });

    it("wraps non-object data in { value } envelope", () => {
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
  });

  // ── Timestamp ─────────────────────────────────────────────────────────────

  describe("timestamp", () => {
    it("sets timestamp close to Date.now()", () => {
      const before = Date.now();
      const result = transformer.transform(makeRaw("session.event.part.text"));
      const after = Date.now();
      expect(result?.timestamp).toBeGreaterThanOrEqual(before);
      expect(result?.timestamp).toBeLessThanOrEqual(after);
    });
  });
});
