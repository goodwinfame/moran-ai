/**
 * Usage API Routes — Integration Tests
 *
 * Tests GET /api/projects/:id/usage/summary and /details with mocked costService.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Service mocks (must be declared before imports) ────────────────────────────

const mockValidateSession = vi.fn();
const mockGetSummary = vi.fn();
const mockGetDetails = vi.fn();

vi.mock("@moran/core/services", () => ({
  authService: {
    validateSession: (...args: unknown[]) => mockValidateSession(...args),
  },
  costService: {
    getSummary: (...args: unknown[]) => mockGetSummary(...args),
    getDetails: (...args: unknown[]) => mockGetDetails(...args),
  },
}));

import { createApp } from "../../app.js";
import { createUsageRoutes } from "../../routes/usage.js";

const { app } = createApp();
app.route("/api/projects/:id/usage", createUsageRoutes());

function get(path: string) {
  return app.request(path, {
    method: "GET",
    headers: { Cookie: "session_id=test-session" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateSession.mockResolvedValue({ ok: true, data: { userId: "user-1" } });
});

// ── Summary ────────────────────────────────────────────────────────────────────

describe("GET /api/projects/:id/usage/summary", () => {
  const mockSummary = {
    totalTokens: 5000,
    totalCostUsd: 0.015,
    byAgent: { moheng: { tokens: 3000, cost: 0.009 } },
    byModel: { "claude-sonnet-4": { tokens: 5000, cost: 0.015 } },
    dailyTrend: [{ date: "2026-04-19", tokens: 5000, cost: 0.015 }],
  };

  it("returns summary on success", async () => {
    mockGetSummary.mockResolvedValue({ ok: true, data: mockSummary });

    const res = await get("/api/projects/proj-1/usage/summary");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual(mockSummary);
    expect(mockGetSummary).toHaveBeenCalledWith({
      projectId: "proj-1",
      from: undefined,
      to: undefined,
    });
  });

  it("passes ?from= and ?to= to service", async () => {
    mockGetSummary.mockResolvedValue({ ok: true, data: mockSummary });

    const res = await get("/api/projects/proj-1/usage/summary?from=2026-04-01&to=2026-04-30");
    expect(res.status).toBe(200);
    expect(mockGetSummary).toHaveBeenCalledWith({
      projectId: "proj-1",
      from: "2026-04-01",
      to: "2026-04-30",
    });
  });

  it("returns 500 when service fails", async () => {
    mockGetSummary.mockResolvedValue({
      ok: false,
      error: { code: "DB_ERROR", message: "db down" },
    });

    const res = await get("/api/projects/proj-1/usage/summary");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("DB_ERROR");
  });

  it("returns 401 without session cookie", async () => {
    const res = await app.request("/api/projects/proj-1/usage/summary");
    expect(res.status).toBe(401);
  });
});

// ── Details ────────────────────────────────────────────────────────────────────

describe("GET /api/projects/:id/usage/details", () => {
  const mockDetails = {
    records: [
      {
        id: "rec-1",
        projectId: "proj-1",
        userId: "user-1",
        model: "claude-sonnet-4",
        agentName: "moheng",
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        estimatedCostUsd: "0.00001050",
        createdAt: "2026-04-19T10:00:00.000Z",
      },
    ],
    total: 1,
  };

  it("returns paginated details on success", async () => {
    mockGetDetails.mockResolvedValue({ ok: true, data: mockDetails });

    const res = await get("/api/projects/proj-1/usage/details");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.total).toBe(1);
    expect(body.data.records).toHaveLength(1);
  });

  it("passes default limit=50 and offset=0 to service", async () => {
    mockGetDetails.mockResolvedValue({ ok: true, data: mockDetails });

    await get("/api/projects/proj-1/usage/details");
    expect(mockGetDetails).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "proj-1", limit: 50, offset: 0 }),
    );
  });

  it("passes custom limit, offset, agentName, model to service", async () => {
    mockGetDetails.mockResolvedValue({ ok: true, data: mockDetails });

    await get(
      "/api/projects/proj-1/usage/details?limit=10&offset=20&agentName=moheng&model=claude-sonnet-4",
    );
    expect(mockGetDetails).toHaveBeenCalledWith({
      projectId: "proj-1",
      limit: 10,
      offset: 20,
      agentName: "moheng",
      model: "claude-sonnet-4",
    });
  });

  it("returns 500 when service fails", async () => {
    mockGetDetails.mockResolvedValue({
      ok: false,
      error: { code: "DB_ERROR", message: "db down" },
    });

    const res = await get("/api/projects/proj-1/usage/details");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("DB_ERROR");
  });

  it("returns 401 without session cookie", async () => {
    const res = await app.request("/api/projects/proj-1/usage/details");
    expect(res.status).toBe(401);
  });
});
