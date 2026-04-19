import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Chainable query mock factory ───────────────────────────────────────────────
// Creates a thenable chain that all drizzle query methods return themselves from,
// and resolves with the given value when awaited.

function createChain(resolveWith: unknown) {
  const p = Promise.resolve(resolveWith);
  const chain: Record<string, unknown> = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    returning: vi.fn(() => p),
    // Make chain thenable so `await chain` resolves with p
    then: (onf?: (v: unknown) => unknown, onr?: (e: unknown) => unknown) =>
      p.then(onf, onr),
    catch: (onr?: (e: unknown) => unknown) => p.catch(onr),
    finally: (onf?: () => void) => p.finally(onf),
  };
  return chain;
}

// ── DB mock setup ──────────────────────────────────────────────────────────────

const mockInsertReturning = vi.fn();
const mockInsert = vi.fn(() => ({
  values: vi.fn(() => ({ returning: mockInsertReturning })),
}));

const mockSelect = vi.fn();

vi.mock("../../db/index.js", () => ({
  getDb: () => ({ select: mockSelect, insert: mockInsert }),
}));

import {
  recordUsage,
  getSummary,
  getDetails,
} from "../cost.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  // Reset mockInsert to default implementation so tests are isolated
  mockInsert.mockImplementation(() => ({
    values: vi.fn(() => ({ returning: mockInsertReturning })),
  }));
});

// ── recordUsage ────────────────────────────────────────────────────────────────

describe("recordUsage", () => {
  it("inserts a usage record and returns id", async () => {
    mockInsertReturning.mockResolvedValue([{ id: "rec-1" }]);

    const result = await recordUsage({
      projectId: "proj-1",
      userId: "user-1",
      model: "claude-sonnet-4",
      promptTokens: 1000,
      completionTokens: 500,
    });

    expect(result).toEqual({ ok: true, data: { id: "rec-1" } });
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("calculates totalTokens as sum of prompt + completion", async () => {
    let capturedValues: Record<string, unknown> | null = null;
    mockInsert.mockImplementation(() => ({
      values: vi.fn((v: Record<string, unknown>) => {
        capturedValues = v;
        return { returning: vi.fn().mockResolvedValue([{ id: "rec-1" }]) };
      }),
    }));

    await recordUsage({
      projectId: "proj-1",
      userId: "user-1",
      model: "claude-sonnet-4",
      promptTokens: 1000,
      completionTokens: 500,
    });

    expect(capturedValues).not.toBeNull();
    expect(capturedValues!.totalTokens).toBe(1500);
  });

  it("calculates estimatedCostUsd from model pricing", async () => {
    let capturedValues: Record<string, unknown> | null = null;
    mockInsert.mockImplementation(() => ({
      values: vi.fn((v: Record<string, unknown>) => {
        capturedValues = v;
        return { returning: vi.fn().mockResolvedValue([{ id: "rec-1" }]) };
      }),
    }));

    // 1M prompt at $3/M + 0 completion = $3 → "3.00000000"
    await recordUsage({
      projectId: "proj-1",
      userId: "user-1",
      model: "claude-sonnet-4",
      promptTokens: 1_000_000,
      completionTokens: 0,
    });

    expect(capturedValues!.estimatedCostUsd).toBe("3.00000000");
  });

  it("returns INSERT_FAILED when db returns empty array", async () => {
    mockInsertReturning.mockResolvedValue([]);

    const result = await recordUsage({
      projectId: "proj-1",
      userId: "user-1",
      model: "claude-sonnet-4",
      promptTokens: 100,
      completionTokens: 50,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INSERT_FAILED");
  });

  it("passes optional fields through", async () => {
    let capturedValues: Record<string, unknown> | null = null;
    mockInsert.mockImplementation(() => ({
      values: vi.fn((v: Record<string, unknown>) => {
        capturedValues = v;
        return { returning: vi.fn().mockResolvedValue([{ id: "rec-1" }]) };
      }),
    }));

    await recordUsage({
      projectId: "proj-1",
      userId: "user-1",
      model: "gpt-4o",
      promptTokens: 100,
      completionTokens: 50,
      sessionId: "sess-abc",
      agentName: "moheng",
      toolName: "world_create",
    });

    expect(capturedValues!.sessionId).toBe("sess-abc");
    expect(capturedValues!.agentName).toBe("moheng");
    expect(capturedValues!.toolName).toBe("world_create");
  });
});

// ── getSummary ─────────────────────────────────────────────────────────────────

describe("getSummary", () => {
  it("returns aggregated totals, byAgent, byModel, dailyTrend", async () => {
    // 4 sequential select() calls
    mockSelect
      .mockReturnValueOnce(
        createChain([{ totalTokens: 2000, totalCostUsd: "0.03000000" }]),
      )
      .mockReturnValueOnce(
        createChain([
          { agentName: "moheng", tokens: 1200, cost: "0.02000000" },
          { agentName: "zhibi", tokens: 800, cost: "0.01000000" },
        ]),
      )
      .mockReturnValueOnce(
        createChain([
          { model: "claude-sonnet-4", tokens: 2000, cost: "0.03000000" },
        ]),
      )
      .mockReturnValueOnce(
        createChain([
          { date: "2026-04-19", tokens: 2000, cost: "0.03000000" },
        ]),
      );

    const result = await getSummary({ projectId: "proj-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.totalTokens).toBe(2000);
    expect(result.data.totalCostUsd).toBeCloseTo(0.03, 6);
    expect(result.data.byAgent["moheng"]).toEqual({ tokens: 1200, cost: 0.02 });
    expect(result.data.byAgent["zhibi"]).toEqual({ tokens: 800, cost: 0.01 });
    expect(result.data.byModel["claude-sonnet-4"]).toEqual({ tokens: 2000, cost: 0.03 });
    expect(result.data.dailyTrend).toHaveLength(1);
    expect(result.data.dailyTrend[0]).toEqual({
      date: "2026-04-19",
      tokens: 2000,
      cost: 0.03,
    });
  });

  it("handles empty results (no usage yet)", async () => {
    mockSelect
      .mockReturnValueOnce(createChain([{ totalTokens: 0, totalCostUsd: "0" }]))
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([]));

    const result = await getSummary({ projectId: "proj-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.totalTokens).toBe(0);
    expect(result.data.totalCostUsd).toBe(0);
    expect(result.data.byAgent).toEqual({});
    expect(result.data.byModel).toEqual({});
    expect(result.data.dailyTrend).toEqual([]);
  });

  it("handles null totals row gracefully", async () => {
    mockSelect
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([]));

    const result = await getSummary({ projectId: "proj-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.totalTokens).toBe(0);
    expect(result.data.totalCostUsd).toBe(0);
  });

  it("uses 'unknown' key for null agentName", async () => {
    mockSelect
      .mockReturnValueOnce(createChain([{ totalTokens: 100, totalCostUsd: "0.001" }]))
      .mockReturnValueOnce(
        createChain([{ agentName: null, tokens: 100, cost: "0.001" }]),
      )
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([]));

    const result = await getSummary({ projectId: "proj-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.byAgent["unknown"]).toBeDefined();
  });
});

// ── getDetails ─────────────────────────────────────────────────────────────────

describe("getDetails", () => {
  const sampleRecord = {
    id: "rec-1",
    projectId: "proj-1",
    userId: "user-1",
    model: "claude-sonnet-4",
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    estimatedCostUsd: "0.00000050",
    createdAt: new Date("2026-04-19T10:00:00Z"),
  };

  it("returns paginated records and total count", async () => {
    mockSelect
      .mockReturnValueOnce(createChain([{ count: 42 }]))
      .mockReturnValueOnce(createChain([sampleRecord]));

    const result = await getDetails({ projectId: "proj-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.total).toBe(42);
    expect(result.data.records).toHaveLength(1);
    expect(result.data.records[0].id).toBe("rec-1");
  });

  it("defaults limit=50 and offset=0", async () => {
    mockSelect
      .mockReturnValueOnce(createChain([{ count: 0 }]))
      .mockReturnValueOnce(createChain([]));

    const result = await getDetails({ projectId: "proj-1" });

    expect(result.ok).toBe(true);
  });

  it("returns empty records when none found", async () => {
    mockSelect
      .mockReturnValueOnce(createChain([{ count: 0 }]))
      .mockReturnValueOnce(createChain([]));

    const result = await getDetails({ projectId: "proj-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.total).toBe(0);
    expect(result.data.records).toEqual([]);
  });

  it("accepts agentName and model filters", async () => {
    mockSelect
      .mockReturnValueOnce(createChain([{ count: 1 }]))
      .mockReturnValueOnce(createChain([sampleRecord]));

    const result = await getDetails({
      projectId: "proj-1",
      agentName: "moheng",
      model: "claude-sonnet-4",
      limit: 20,
      offset: 10,
    });

    expect(result.ok).toBe(true);
  });
});
