/**
 * Log cleanup job — Unit Tests
 *
 * Tests startLogCleanup / stopLogCleanup interval behaviour using fake timers.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ── Mocks (declared before imports) ───────────────────────────────────────────

const mockCleanup = vi.fn();

vi.mock("@moran/core/services", () => ({
  logService: {
    cleanup: (...args: unknown[]) => mockCleanup(...args),
  },
}));

const mockGetDb = vi.fn();
const mockDelete = vi.fn();
const mockWhere = vi.fn();
const mockReturning = vi.fn();

vi.mock("@moran/core/db", () => ({
  getDb: () => mockGetDb(),
}));

vi.mock("@moran/core/db/schema", () => ({
  usageRecords: { createdAt: "createdAt" },
}));

// Mock drizzle-orm lt/sql used inside log-cleanup
vi.mock("drizzle-orm", () => ({
  lt: vi.fn((_col: unknown, _val: unknown) => "lt-condition"),
  sql: new Proxy(
    (_strings: TemplateStringsArray, ..._values: unknown[]) => "sql-expr",
    {
      get(_target, prop) {
        if (prop === Symbol.toPrimitive || prop === "raw") return undefined;
        return (_strings: TemplateStringsArray, ..._values: unknown[]) => "sql-expr";
      },
    },
  ),
}));

const mockLogInfo = vi.fn();
const mockLogError = vi.fn();

vi.mock("@moran/core/logger", () => ({
  createLogger: () => ({
    info: (...args: unknown[]) => mockLogInfo(...args),
    error: (...args: unknown[]) => mockLogError(...args),
  }),
}));

import { startLogCleanup, stopLogCleanup } from "../../jobs/log-cleanup.js";

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();

  // Default: cleanup succeeds
  mockCleanup.mockResolvedValue({ ok: true, data: { deleted: 5 } });

  // DB chain mock
  mockReturning.mockResolvedValue([{ id: "rec-1" }]);
  mockWhere.mockReturnValue({ returning: mockReturning });
  mockDelete.mockReturnValue({ where: mockWhere });
  mockGetDb.mockReturnValue({ delete: mockDelete });
});

afterEach(() => {
  stopLogCleanup();
  vi.useRealTimers();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("startLogCleanup", () => {
  it("calls logService.cleanup immediately on startup", async () => {
    startLogCleanup();
    // Advance by 0ms to flush the immediate void runCleanup() promise
    await vi.advanceTimersByTimeAsync(0);

    expect(mockCleanup).toHaveBeenCalledWith(90);
  });

  it("registers a 24-hour interval", async () => {
    startLogCleanup();
    await vi.advanceTimersByTimeAsync(0);

    const callsAfterStart = mockCleanup.mock.calls.length;

    // Advance one full interval — setInterval fires once
    await vi.advanceTimersByTimeAsync(CLEANUP_INTERVAL_MS);

    expect(mockCleanup.mock.calls.length).toBeGreaterThan(callsAfterStart);
  });

  it("logs a registration message on startup", () => {
    startLogCleanup();
    expect(mockLogInfo).toHaveBeenCalledWith(expect.stringContaining("cleanup job registered"));
  });
});

describe("stopLogCleanup", () => {
  it("clears the interval so no further cleanups run", async () => {
    startLogCleanup();
    await vi.advanceTimersByTimeAsync(0);

    stopLogCleanup();
    const callsAfterStop = mockCleanup.mock.calls.length;

    // Advance two full intervals — no new calls expected
    await vi.advanceTimersByTimeAsync(CLEANUP_INTERVAL_MS * 2);

    expect(mockCleanup.mock.calls.length).toBe(callsAfterStop);
  });

  it("is safe to call multiple times without error", () => {
    startLogCleanup();
    expect(() => {
      stopLogCleanup();
      stopLogCleanup();
    }).not.toThrow();
  });
});

describe("runCleanup error handling", () => {
  it("does not throw when logService.cleanup rejects", async () => {
    mockCleanup.mockRejectedValue(new Error("db exploded"));

    startLogCleanup();
    // Advance 0ms to let the immediate runCleanup promise settle
    await vi.advanceTimersByTimeAsync(0);

    expect(mockLogError).toHaveBeenCalled();
  });

  it("does not throw when usageRecords DB delete fails", async () => {
    mockCleanup.mockResolvedValue({ ok: true, data: { deleted: 0 } });
    mockReturning.mockRejectedValue(new Error("usage db error"));

    startLogCleanup();
    await vi.advanceTimersByTimeAsync(0);

    expect(mockLogError).toHaveBeenCalled();
  });
});
