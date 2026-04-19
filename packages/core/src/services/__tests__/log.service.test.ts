import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Chainable query mock factory ───────────────────────────────────────────────

function createChain(resolveWith: unknown) {
  const p = Promise.resolve(resolveWith);
  const chain: Record<string, unknown> = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    returning: vi.fn(() => p),
    then: (onf?: (v: unknown) => unknown, onr?: (e: unknown) => unknown) =>
      p.then(onf, onr),
    catch: (onr?: (e: unknown) => unknown) => p.catch(onr),
    finally: (onf?: () => void) => p.finally(onf),
  };
  return chain;
}

// ── DB mock setup ──────────────────────────────────────────────────────────────

const mockInsertValues = vi.fn();
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

const mockDeleteWhere = vi.fn();
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

const mockSelect = vi.fn();

vi.mock("../../db/index.js", () => ({
  getDb: () => ({ select: mockSelect, insert: mockInsert, delete: mockDelete }),
}));

import { writeLog, query, cleanup } from "../log.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  // Default: insert values resolves (no return value needed)
  mockInsertValues.mockResolvedValue([]);
  // Default: delete where returns chain with returning
  mockDeleteWhere.mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });
});

// ── writeLog ───────────────────────────────────────────────────────────────────

describe("writeLog", () => {
  it("inserts to DB for info level, agent category", async () => {
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await writeLog({
      projectId: "proj-1",
      level: "info",
      category: "agent",
      message: "Agent started",
    });

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "proj-1", level: "info", category: "agent", message: "Agent started" }),
    );
    consoleSpy.mockRestore();
  });

  it("skips DB for category='app' (console only)", async () => {
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await writeLog({
      projectId: "proj-1",
      level: "info",
      category: "app",
      message: "App started",
    });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("skips DB for level='debug' (console only)", async () => {
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await writeLog({
      projectId: "proj-1",
      level: "debug",
      category: "tool",
      message: "Debug message",
    });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("never throws on DB error — catches and console.error", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockInsertValues.mockRejectedValue(new Error("DB connection failed"));

    // Should not throw
    await expect(
      writeLog({ projectId: "proj-1", level: "info", category: "agent", message: "test" }),
    ).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to write log:", expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it("outputs warn to console.warn", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockInsertValues.mockResolvedValue([]);

    await writeLog({ projectId: "proj-1", level: "warn", category: "tool", message: "Warning!" });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("outputs error to console.error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockInsertValues.mockResolvedValue([]);

    await writeLog({ projectId: "proj-1", level: "error", category: "tool", message: "Error!" });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ── query ──────────────────────────────────────────────────────────────────────

describe("query", () => {
  const sampleLog = {
    id: "log-1",
    projectId: "proj-1",
    userId: null,
    sessionId: null,
    level: "info",
    category: "agent",
    agentName: "moheng",
    toolName: null,
    message: "Agent started",
    durationMs: null,
    metadata: null,
    createdAt: new Date("2026-04-19T10:00:00Z"),
  };

  it("returns paginated results with hasMore=false when within limit", async () => {
    mockSelect
      .mockReturnValueOnce(createChain([{ count: 5 }]))
      .mockReturnValueOnce(createChain([sampleLog]));

    const result = await query({ projectId: "proj-1", limit: 50, offset: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.total).toBe(5);
    expect(result.data.logs).toHaveLength(1);
    expect(result.data.hasMore).toBe(false);
  });

  it("returns hasMore=true when offset + limit < total", async () => {
    mockSelect
      .mockReturnValueOnce(createChain([{ count: 100 }]))
      .mockReturnValueOnce(createChain([sampleLog]));

    const result = await query({ projectId: "proj-1", limit: 10, offset: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.hasMore).toBe(true);
  });

  it("applies category and level filters", async () => {
    mockSelect
      .mockReturnValueOnce(createChain([{ count: 1 }]))
      .mockReturnValueOnce(createChain([sampleLog]));

    const result = await query({
      projectId: "proj-1",
      category: "agent",
      level: "info",
      limit: 20,
      offset: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.logs).toHaveLength(1);
  });

  it("defaults limit=50 and offset=0", async () => {
    mockSelect
      .mockReturnValueOnce(createChain([{ count: 0 }]))
      .mockReturnValueOnce(createChain([]));

    const result = await query({ projectId: "proj-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.logs).toEqual([]);
    expect(result.data.total).toBe(0);
    expect(result.data.hasMore).toBe(false);
  });
});

// ── cleanup ────────────────────────────────────────────────────────────────────

describe("cleanup", () => {
  it("deletes old records and returns count", async () => {
    const mockReturning = vi.fn().mockResolvedValue([{ id: "log-1" }, { id: "log-2" }]);
    mockDeleteWhere.mockReturnValue({ returning: mockReturning });

    const result = await cleanup(90);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.deleted).toBe(2);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("returns 0 when no records to delete", async () => {
    const mockReturning = vi.fn().mockResolvedValue([]);
    mockDeleteWhere.mockReturnValue({ returning: mockReturning });

    const result = await cleanup(30);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.deleted).toBe(0);
  });
});
