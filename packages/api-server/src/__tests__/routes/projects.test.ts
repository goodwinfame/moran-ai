/**
 * Project Routes — Integration Tests
 *
 * Uses createApp() + app.request() per project conventions.
 * Mocks @moran/core/services to avoid DB dependency.
 * Routes are mounted on the test app after createApp() since app.ts
 * defers route mounting (done separately per DESIGN.md).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock service functions ────────────────────────────────────────────────────
const mockValidateSession = vi.fn();
const mockProjectList = vi.fn();
const mockProjectCreate = vi.fn();
const mockProjectRead = vi.fn();
const mockProjectUpdate = vi.fn();
const mockProjectRemove = vi.fn();

vi.mock("@moran/core/services", () => ({
  authService: {
    validateSession: (...args: unknown[]) => mockValidateSession(...args),
  },
  projectService: {
    list: (...args: unknown[]) => mockProjectList(...args),
    create: (...args: unknown[]) => mockProjectCreate(...args),
    read: (...args: unknown[]) => mockProjectRead(...args),
    update: (...args: unknown[]) => mockProjectUpdate(...args),
    remove: (...args: unknown[]) => mockProjectRemove(...args),
  },
}));

import { createApp } from "../../app.js";
import { createProjectRoutes } from "../../routes/projects.js";

const { app } = createApp();
app.route("/api/projects", createProjectRoutes());

// ── Helpers ───────────────────────────────────────────────────────────────────
const AUTH_COOKIE = "Cookie: session_id=test-session";

function get(path: string, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: "GET",
    headers: { Cookie: "session_id=test-session", ...headers },
  });
}

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: "session_id=test-session", ...headers },
    body: JSON.stringify(body),
  });
}

function patch(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: "session_id=test-session", ...headers },
    body: JSON.stringify(body),
  });
}

function del(path: string, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: "DELETE",
    headers: { Cookie: "session_id=test-session", ...headers },
  });
}

// Suppress unused variable warning — AUTH_COOKIE is a documentation constant
void AUTH_COOKIE;

beforeEach(() => {
  vi.clearAllMocks();
  // Default: valid session for all requests
  mockValidateSession.mockResolvedValue({ ok: true, data: { userId: "test-user" } });
});

// ── GET /api/projects ─────────────────────────────────────────────────────────
describe("GET /api/projects", () => {
  it("returns project list for the authenticated user", async () => {
    const projects = [
      { id: "proj-1", title: "Novel A", userId: "test-user" },
      { id: "proj-2", title: "Novel B", userId: "test-user" },
    ];
    mockProjectList.mockResolvedValue({ ok: true, data: projects });

    const res = await get("/api/projects");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual(projects);
    expect(mockProjectList).toHaveBeenCalledWith("test-user");
  });

  it("returns 401 when no session cookie is provided", async () => {
    const res = await app.request("/api/projects", { method: "GET" });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("propagates service errors", async () => {
    mockProjectList.mockResolvedValue({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "DB connection failed" },
    });

    const res = await get("/api/projects");

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

// ── POST /api/projects ────────────────────────────────────────────────────────
describe("POST /api/projects", () => {
  it("creates a project and returns 201 with the new id", async () => {
    mockProjectCreate.mockResolvedValue({ ok: true, data: { id: "new-proj-1" } });

    const res = await post("/api/projects", { title: "My New Novel", genre: "仙侠" });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe("new-proj-1");
    expect(mockProjectCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "My New Novel", genre: "仙侠", userId: "test-user" }),
    );
  });

  it("returns 400 when title is missing", async () => {
    const res = await post("/api/projects", { genre: "仙侠" });

    expect(res.status).toBe(400);
    // Zod validation rejects — service must not be called
    expect(mockProjectCreate).not.toHaveBeenCalled();
  });

  it("propagates service errors on create", async () => {
    mockProjectCreate.mockResolvedValue({
      ok: false,
      error: { code: "INSERT_FAILED", message: "项目创建失败" },
    });

    const res = await post("/api/projects", { title: "Conflict Project" });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INSERT_FAILED");
  });
});

// ── GET /api/projects/:id ─────────────────────────────────────────────────────
describe("GET /api/projects/:id", () => {
  it("returns project details for a valid id", async () => {
    const project = { id: "proj-1", title: "Novel A", userId: "test-user" };
    mockProjectRead.mockResolvedValue({ ok: true, data: project });

    const res = await get("/api/projects/proj-1");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual(project);
    expect(mockProjectRead).toHaveBeenCalledWith("proj-1");
  });

  it("returns 404 when project does not exist", async () => {
    mockProjectRead.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "项目不存在" },
    });

    const res = await get("/api/projects/nonexistent-id");

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

// ── PATCH /api/projects/:id ───────────────────────────────────────────────────
describe("PATCH /api/projects/:id", () => {
  it("updates a project and returns the updated record", async () => {
    const updated = { id: "proj-1", title: "Revised Title", status: "writing", userId: "test-user" };
    mockProjectUpdate.mockResolvedValue({ ok: true, data: updated });

    const res = await patch("/api/projects/proj-1", { title: "Revised Title", status: "writing" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.title).toBe("Revised Title");
    expect(mockProjectUpdate).toHaveBeenCalledWith(
      "proj-1",
      expect.objectContaining({ title: "Revised Title", status: "writing" }),
    );
  });

  it("returns 404 when updating a non-existent project", async () => {
    mockProjectUpdate.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "项目不存在" },
    });

    const res = await patch("/api/projects/ghost-id", { title: "Ghost" });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid body (title too long)", async () => {
    const res = await patch("/api/projects/proj-1", { title: "x".repeat(501) });

    expect(res.status).toBe(400);
    expect(mockProjectUpdate).not.toHaveBeenCalled();
  });

  it("accepts settings field in PATCH body", async () => {
    const updated = {
      id: "proj-1",
      title: "Novel",
      settings: { budgetLimitUsd: 50, budgetBehavior: "pause" },
      userId: "test-user",
    };
    mockProjectUpdate.mockResolvedValue({ ok: true, data: updated });

    const res = await patch("/api/projects/proj-1", {
      settings: {
        budgetLimitUsd: 50,
        budgetBehavior: "pause",
        writingParams: { chapterWordCount: 3000 },
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockProjectUpdate).toHaveBeenCalledWith(
      "proj-1",
      expect.objectContaining({
        settings: expect.objectContaining({ budgetLimitUsd: 50 }),
      }),
    );
  });

  it("rejects settings with invalid budgetLimitUsd (negative)", async () => {
    const res = await patch("/api/projects/proj-1", {
      settings: { budgetLimitUsd: -1 },
    });

    expect(res.status).toBe(400);
    expect(mockProjectUpdate).not.toHaveBeenCalled();
  });

  it("rejects settings with invalid writingParams temperature out of range", async () => {
    const res = await patch("/api/projects/proj-1", {
      settings: { writingParams: { temperature: 5 } },
    });

    expect(res.status).toBe(400);
    expect(mockProjectUpdate).not.toHaveBeenCalled();
  });
});

// ── DELETE /api/projects/:id ──────────────────────────────────────────────────
describe("DELETE /api/projects/:id", () => {
  it("deletes a project and returns ok", async () => {
    mockProjectRemove.mockResolvedValue({ ok: true, data: undefined });

    const res = await del("/api/projects/proj-1");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockProjectRemove).toHaveBeenCalledWith("proj-1");
  });

  it("returns 404 when deleting a non-existent project", async () => {
    mockProjectRemove.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "项目不存在" },
    });

    const res = await del("/api/projects/ghost-id");

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
