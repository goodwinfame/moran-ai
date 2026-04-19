/**
 * User Routes — Integration Tests
 *
 * Uses createApp() + app.request() per project conventions.
 * Mocks @moran/core/services to avoid DB dependency.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock service functions ────────────────────────────────────────────────────
const mockValidateSession = vi.fn();
const mockProjectList = vi.fn();

vi.mock("@moran/core/services", () => ({
  authService: {
    validateSession: (...args: unknown[]) => mockValidateSession(...args),
  },
  projectService: {
    list: (...args: unknown[]) => mockProjectList(...args),
  },
}));

import { createApp } from "../../app.js";
import { createUserRoutes } from "../../routes/user.js";

const { app } = createApp();
app.route("/api/user", createUserRoutes());

// ── Helpers ───────────────────────────────────────────────────────────────────
function get(path: string, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: "GET",
    headers: { Cookie: "session_id=test-session", ...headers },
  });
}

function patch(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: "session_id=test-session", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: valid session
  mockValidateSession.mockResolvedValue({ ok: true, data: { userId: "test-user" } });
});

// ── GET /api/user/profile ─────────────────────────────────────────────────────
describe("GET /api/user/profile", () => {
  it("returns the current user's profile (minimal stub)", async () => {
    const res = await get("/api/user/profile");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.userId).toBe("test-user");
  });

  it("returns 401 when no session cookie is provided", async () => {
    const res = await app.request("/api/user/profile", { method: "GET" });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when session is expired", async () => {
    mockValidateSession.mockResolvedValue({
      ok: false,
      error: { code: "SESSION_EXPIRED", message: "Session 已过期" },
    });

    const res = await app.request("/api/user/profile", {
      method: "GET",
      headers: { Cookie: "session_id=expired-session" },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});

// ── PATCH /api/user/profile ───────────────────────────────────────────────────
describe("PATCH /api/user/profile", () => {
  it("accepts a valid displayName update and returns ok", async () => {
    const res = await patch("/api/user/profile", { displayName: "New Name" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.userId).toBe("test-user");
  });

  it("returns 400 when displayName is empty string", async () => {
    const res = await patch("/api/user/profile", { displayName: "" });

    // Zod validation rejects empty string (min(1))
    expect(res.status).toBe(400);
  });

  it("accepts optional preferences object", async () => {
    const res = await patch("/api/user/profile", {
      displayName: "Writer",
      preferences: { theme: "dark" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

// ── GET /api/user/stats ───────────────────────────────────────────────────────
describe("GET /api/user/stats", () => {
  it("returns total project count for the user", async () => {
    mockProjectList.mockResolvedValue({
      ok: true,
      data: [
        { id: "p1", title: "Novel 1" },
        { id: "p2", title: "Novel 2" },
        { id: "p3", title: "Novel 3" },
      ],
    });

    const res = await get("/api/user/stats");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.totalProjects).toBe(3);
    expect(body.data.userId).toBe("test-user");
    expect(mockProjectList).toHaveBeenCalledWith("test-user");
  });

  it("returns 500 when project list fails", async () => {
    mockProjectList.mockResolvedValue({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "DB error" },
    });

    const res = await get("/api/user/stats");

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("returns zero totalProjects when user has no projects", async () => {
    mockProjectList.mockResolvedValue({ ok: true, data: [] });

    const res = await get("/api/user/stats");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.totalProjects).toBe(0);
  });
});
