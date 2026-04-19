import { describe, expect, it, vi, beforeEach } from "vitest";
import { ok, fail, fromService } from "../../utils/response.js";
import type { MCPToolResponse } from "../../types.js";

beforeEach(() => {
  vi.clearAllMocks();
});

function parseText(response: MCPToolResponse): unknown {
  const text = response.content[0]?.text;
  if (!text) throw new Error("Empty response content");
  return JSON.parse(text);
}

describe("ok()", () => {
  it("returns content array with type=text", () => {
    const result = ok({ id: "123" });
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe("text");
  });

  it("wraps data in { ok: true, data } envelope", () => {
    const data = { id: "abc", name: "test" };
    const result = ok(data);
    const parsed = parseText(result);
    expect(parsed).toEqual({ ok: true, data });
  });

  it("does not set isError", () => {
    const result = ok(null);
    expect(result.isError).toBeUndefined();
  });

  it("handles null data", () => {
    const result = ok(null);
    const parsed = parseText(result);
    expect(parsed).toEqual({ ok: true, data: null });
  });

  it("handles array data", () => {
    const data = [1, 2, 3];
    const result = ok(data);
    const parsed = parseText(result);
    expect(parsed).toEqual({ ok: true, data });
  });

  it("handles string data", () => {
    const result = ok("hello");
    const parsed = parseText(result);
    expect(parsed).toEqual({ ok: true, data: "hello" });
  });

  it("handles nested object data", () => {
    const data = { a: { b: { c: 42 } } };
    const result = ok(data);
    const parsed = parseText(result);
    expect(parsed).toEqual({ ok: true, data });
  });

  it("text is valid JSON", () => {
    const result = ok({ x: 1 });
    expect(() => JSON.parse(result.content[0]!.text)).not.toThrow();
  });
});

describe("fail()", () => {
  it("returns content array with type=text", () => {
    const result = fail("NOT_FOUND", "not found");
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe("text");
  });

  it("sets isError: true", () => {
    const result = fail("INTERNAL", "error");
    expect(result.isError).toBe(true);
  });

  it("wraps error in { ok: false, error } envelope", () => {
    const result = fail("NOT_FOUND", "Resource not found");
    const parsed = parseText(result) as { ok: boolean; error: { code: string; message: string } };
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("NOT_FOUND");
    expect(parsed.error.message).toBe("Resource not found");
  });

  it("includes details when provided", () => {
    const details = { passed: ["a"], failed: ["b"], suggestions: ["do c"] };
    const result = fail("GATE_FAILED", "gate failed", details);
    const parsed = parseText(result) as {
      ok: boolean;
      error: { code: string; message: string; details: unknown };
    };
    expect(parsed.error.details).toEqual(details);
  });

  it("omits details when not provided", () => {
    const result = fail("VALIDATION", "invalid input");
    const parsed = parseText(result) as {
      ok: boolean;
      error: { code: string; message: string; details?: unknown };
    };
    expect(parsed.error.details).toBeUndefined();
  });

  it("accepts ErrorCode union values", () => {
    const codes = [
      "GATE_FAILED",
      "NOT_FOUND",
      "CONFLICT",
      "VALIDATION",
      "PATCH_NO_MATCH",
      "INTERNAL",
      "NOT_IMPLEMENTED",
    ] as const;
    for (const code of codes) {
      const result = fail(code, "msg");
      const parsed = parseText(result) as { error: { code: string } };
      expect(parsed.error.code).toBe(code);
    }
  });

  it("accepts arbitrary string code", () => {
    const result = fail("CUSTOM_ERROR", "custom");
    const parsed = parseText(result) as { error: { code: string } };
    expect(parsed.error.code).toBe("CUSTOM_ERROR");
  });

  it("includes Record details (non-GateDetails)", () => {
    const details = { field: "name", reason: "too short" };
    const result = fail("VALIDATION", "validation failed", details);
    const parsed = parseText(result) as {
      error: { details: Record<string, unknown> };
    };
    expect(parsed.error.details).toEqual(details);
  });

  it("text is valid JSON", () => {
    const result = fail("INTERNAL", "oops");
    expect(() => JSON.parse(result.content[0]!.text)).not.toThrow();
  });
});

describe("fromService()", () => {
  it("returns ok() response when result.ok is true", () => {
    const serviceResult = { ok: true as const, data: { id: "1", title: "Test" } };
    const result = fromService(serviceResult);
    expect(result.isError).toBeUndefined();
    const parsed = parseText(result) as { ok: boolean; data: unknown };
    expect(parsed.ok).toBe(true);
    expect(parsed.data).toEqual(serviceResult.data);
  });

  it("returns fail() response when result.ok is false", () => {
    const serviceResult = {
      ok: false as const,
      error: { code: "NOT_FOUND", message: "Project not found" },
    };
    const result = fromService(serviceResult);
    expect(result.isError).toBe(true);
    const parsed = parseText(result) as {
      ok: boolean;
      error: { code: string; message: string };
    };
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("NOT_FOUND");
    expect(parsed.error.message).toBe("Project not found");
  });

  it("passes data through unchanged on success", () => {
    const data = [{ id: "a" }, { id: "b" }];
    const result = fromService({ ok: true as const, data });
    const parsed = parseText(result) as { data: unknown };
    expect(parsed.data).toEqual(data);
  });

  it("passes error code and message through on failure", () => {
    const result = fromService({
      ok: false as const,
      error: { code: "CONFLICT", message: "Already exists" },
    });
    const parsed = parseText(result) as {
      error: { code: string; message: string; details?: unknown };
    };
    expect(parsed.error.code).toBe("CONFLICT");
    expect(parsed.error.message).toBe("Already exists");
    expect(parsed.error.details).toBeUndefined();
  });

  it("success result has no isError flag", () => {
    const result = fromService({ ok: true as const, data: null });
    expect(result.isError).toBeUndefined();
  });

  it("error result has isError: true", () => {
    const result = fromService({
      ok: false as const,
      error: { code: "INTERNAL", message: "crash" },
    });
    expect(result.isError).toBe(true);
  });
});
