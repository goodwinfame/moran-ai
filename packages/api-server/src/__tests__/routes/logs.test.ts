/**
 * Log API Routes — Integration Tests
 *
 * Tests GET /api/projects/:id/logs with mocked logService.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Service mocks (must be declared before imports) ────────────────────────────

const mockValidateSession = vi.fn();
const mockQuery = vi.fn();

vi.mock("@moran/core/services", () => ({
  authService: {
    validateSession: (...args: unknown[]) => mockValidateSession(...args),
  },
  logService: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

import { createApp } from "../../app.js";
import { createLogRoutes } from "../../routes/logs.js";

const { app } = createApp();
app.route("/api/projects/:id/logs", createLogRoutes());

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

// ── Log query ──────────────────────────────────────────────────────────────────

describe("GET /api/projects/:id/logs", () => {
  const mockLogs = {
    logs: [
      {
        id: "log-1",
        projectId: "proj-1",
        userId: "user-1",
        sessionId: "sess-1",
        level: "info",
        category: "agent",
        agentName: "moheng",
        toolName: null,
        message: "Agent started",
        durationMs: null,
        metadata: null,
        createdAt: "2026-04-19T10:00:00.000Z",
      },
    ],
    total: 1,
    hasMore: false,
  };

  it("returns paginated logs on success", async () => {
    mockQuery.mockResolvedValue({ ok: true, data: mockLogs });

    const res = await get("/api/projects/proj-1/logs");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.total).toBe(1);
    expect(body.data.logs).toHaveLength(1);
    expect(body.data.hasMore).toBe(false);
  });

  it("passes category and level filters to service", async () => {
    mockQuery.mockResolvedValue({ ok: true, data: mockLogs });

    const res = await get("/api/projects/proj-1/logs?category=agent&level=info");
    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "proj-1", category: "agent", level: "info" }),
    );
  });

  it("defaults limit=50 and offset=0 when not provided", async () => {
    mockQuery.mockResolvedValue({ ok: true, data: mockLogs });

    await get("/api/projects/proj-1/logs");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "proj-1", limit: 50, offset: 0 }),
    );
  });

  it("passes custom limit and offset to service", async () => {
    mockQuery.mockResolvedValue({ ok: true, data: mockLogs });

    await get("/api/projects/proj-1/logs?limit=10&offset=20");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "proj-1", limit: 10, offset: 20 }),
    );
  });

  it("returns 500 when service fails", async () => {
    mockQuery.mockResolvedValue({
      ok: false,
      error: { code: "DB_ERROR", message: "db down" },
    });

    const res = await get("/api/projects/proj-1/logs");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("DB_ERROR");
  });

  it("returns 401 without session cookie", async () => {
    const res = await app.request("/api/projects/proj-1/logs");
    expect(res.status).toBe(401);
  });
});
