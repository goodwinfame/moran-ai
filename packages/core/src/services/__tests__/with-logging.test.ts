import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock log.service ───────────────────────────────────────────────────────────
// Use vi.hoisted so mockWriteLog is available when vi.mock factory is hoisted.

const mockWriteLog = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../log.service.js", () => ({
  writeLog: mockWriteLog,
}));

import { withLogging } from "../with-logging.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteLog.mockResolvedValue(undefined);
});

// ── withLogging ────────────────────────────────────────────────────────────────

describe("withLogging", () => {
  it("wraps function, calls it, writeLog called with level='info' on success", async () => {
    const fn = vi.fn().mockResolvedValue("result");
    const wrapped = withLogging("my_tool", fn);

    const result = await wrapped("arg1", "arg2");

    expect(result).toBe("result");
    expect(fn).toHaveBeenCalledWith("arg1", "arg2");
    expect(mockWriteLog).toHaveBeenCalledTimes(1);
    expect(mockWriteLog).toHaveBeenCalledWith(
      expect.objectContaining({ level: "info", category: "tool", toolName: "my_tool" }),
    );
  });

  it("wraps failing function, writeLog called with level='error', original error re-thrown", async () => {
    const err = new Error("something went wrong");
    const fn = vi.fn().mockRejectedValue(err);
    const wrapped = withLogging("failing_tool", fn);

    await expect(wrapped()).rejects.toThrow("something went wrong");

    expect(mockWriteLog).toHaveBeenCalledTimes(1);
    expect(mockWriteLog).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "error",
        category: "tool",
        toolName: "failing_tool",
        metadata: expect.objectContaining({ error: "something went wrong" }),
      }),
    );
  });

  it("records durationMs > 0", async () => {
    const fn = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve("done"), 10)),
    );
    const wrapped = withLogging("timed_tool", fn);

    await wrapped();

    expect(mockWriteLog).toHaveBeenCalledWith(
      expect.objectContaining({ durationMs: expect.any(Number) }),
    );
    const call = mockWriteLog.mock.calls[0][0] as { durationMs: number };
    expect(call.durationMs).toBeGreaterThan(0);
  });

  it("uses extractId when provided", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const wrapped = withLogging("id_tool", fn, {
      extractId: (args) => (args[0] as { id: string }).id,
    });

    await wrapped({ id: "entity-42" });

    const call = mockWriteLog.mock.calls[0][0] as { message: string };
    expect(call.message).toContain("entity-42");
  });

  it("uses '[no id extractor]' when no extractId provided", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const wrapped = withLogging("no_id_tool", fn);

    await wrapped("some-arg");

    const call = mockWriteLog.mock.calls[0][0] as { message: string };
    expect(call.message).toContain("[no id extractor]");
  });
});
