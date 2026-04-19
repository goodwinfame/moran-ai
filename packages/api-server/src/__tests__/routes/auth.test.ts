/**
 * Auth Routes — Integration Tests
 *
 * Uses createApp() + app.request() per project conventions.
 * Mocks @moran/core/services to avoid DB dependency.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the auth service
const mockRegister = vi.fn();
const mockLogin = vi.fn();
const mockCreateSession = vi.fn();
const mockValidateSession = vi.fn();
const mockDeleteSession = vi.fn();

vi.mock("@moran/core/services", () => ({
  authService: {
    register: (...args: unknown[]) => mockRegister(...args),
    login: (...args: unknown[]) => mockLogin(...args),
    createSession: (...args: unknown[]) => mockCreateSession(...args),
    validateSession: (...args: unknown[]) => mockValidateSession(...args),
    deleteSession: (...args: unknown[]) => mockDeleteSession(...args),
  },
}));

import { createApp } from "../../app.js";

const { app } = createApp();

function jsonPost(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function postWithCookie(path: string, cookie: string) {
  return app.request(path, {
    method: "POST",
    headers: { Cookie: cookie },
  });
}

function parseCookies(res: Response): Record<string, string> {
  const cookies: Record<string, string> = {};
  const setCookieHeaders = res.headers.getSetCookie();
  for (const header of setCookieHeaders) {
    const [pair] = header.split(";");
    if (pair) {
      const [key, value] = pair.split("=");
      if (key && value !== undefined) {
        cookies[key.trim()] = value.trim();
      }
    }
  }
  return cookies;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/register", () => {
  it("registers successfully and sets session cookie", async () => {
    mockRegister.mockResolvedValue({ ok: true, data: { userId: "user-1" } });
    mockCreateSession.mockResolvedValue({ id: "session-1" });

    const res = await jsonPost("/api/auth/register", {
      email: "test@example.com",
      password: "password123",
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ ok: true, data: { userId: "user-1" } });

    // Verify session cookie set
    const cookies = parseCookies(res);
    expect(cookies["session_id"]).toBe("session-1");

    // Verify service calls
    expect(mockRegister).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
    expect(mockCreateSession).toHaveBeenCalledWith("user-1");
  });

  it("returns 400 for duplicate email", async () => {
    mockRegister.mockResolvedValue({
      ok: false,
      error: { code: "EMAIL_EXISTS", message: "邮箱已注册" },
    });

    const res = await jsonPost("/api/auth/register", {
      email: "taken@example.com",
      password: "password123",
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("EMAIL_EXISTS");

    // Should not create session
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid email format", async () => {
    const res = await jsonPost("/api/auth/register", {
      email: "not-an-email",
      password: "password123",
    });

    expect(res.status).toBe(400);
    // Zod validation error, service should not be called
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("returns 400 for password too short", async () => {
    const res = await jsonPost("/api/auth/register", {
      email: "test@example.com",
      password: "short",
    });

    expect(res.status).toBe(400);
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("accepts optional displayName", async () => {
    mockRegister.mockResolvedValue({ ok: true, data: { userId: "user-1" } });
    mockCreateSession.mockResolvedValue({ id: "session-1" });

    const res = await jsonPost("/api/auth/register", {
      email: "test@example.com",
      password: "password123",
      displayName: "Test User",
    });

    expect(res.status).toBe(201);
    expect(mockRegister).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
      displayName: "Test User",
    });
  });
});

describe("POST /api/auth/login", () => {
  it("logs in successfully and sets session cookie", async () => {
    mockLogin.mockResolvedValue({ ok: true, data: { userId: "user-1" } });
    mockCreateSession.mockResolvedValue({ id: "session-2" });

    const res = await jsonPost("/api/auth/login", {
      email: "test@example.com",
      password: "password123",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, data: { userId: "user-1" } });

    const cookies = parseCookies(res);
    expect(cookies["session_id"]).toBe("session-2");
  });

  it("returns 401 for invalid credentials", async () => {
    mockLogin.mockResolvedValue({
      ok: false,
      error: { code: "INVALID_CREDENTIALS", message: "邮箱或密码错误" },
    });

    const res = await jsonPost("/api/auth/login", {
      email: "test@example.com",
      password: "wrongpassword",
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INVALID_CREDENTIALS");

    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("returns 400 for missing fields", async () => {
    const res = await jsonPost("/api/auth/login", {
      email: "test@example.com",
    });

    expect(res.status).toBe(400);
    expect(mockLogin).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/logout", () => {
  it("deletes session and clears cookie", async () => {
    mockDeleteSession.mockResolvedValue(undefined);

    const res = await postWithCookie(
      "/api/auth/logout",
      "session_id=session-1",
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });

    expect(mockDeleteSession).toHaveBeenCalledWith("session-1");

    // Cookie should be cleared (maxAge=0)
    const setCookieHeader = res.headers.getSetCookie().find(h => h.includes("session_id"));
    expect(setCookieHeader).toBeDefined();
    expect(setCookieHeader).toContain("Max-Age=0");
  });

  it("succeeds even without session cookie", async () => {
    const res = await app.request("/api/auth/logout", { method: "POST" });

    expect(res.status).toBe(200);
    expect(mockDeleteSession).not.toHaveBeenCalled();
  });
});

describe("requireAuth middleware", () => {
  it("returns 401 for protected route without cookie", async () => {
    const res = await app.request("/api/projects", { method: "GET" });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 for expired session", async () => {
    mockValidateSession.mockResolvedValue({
      ok: false,
      error: { code: "SESSION_EXPIRED", message: "Session expired" },
    });

    const res = await app.request("/api/projects", {
      method: "GET",
      headers: { Cookie: "session_id=expired-session" },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("allows auth routes without cookie (auth is public)", async () => {
    mockLogin.mockResolvedValue({ ok: true, data: { userId: "user-1" } });
    mockCreateSession.mockResolvedValue({ id: "session-1" });

    const res = await jsonPost("/api/auth/login", {
      email: "test@example.com",
      password: "password",
    });

    // Should not return 401 — auth routes are public
    expect(res.status).not.toBe(401);
  });
});

describe("cookie attributes", () => {
  it("sets httpOnly and sameSite=Lax on register", async () => {
    mockRegister.mockResolvedValue({ ok: true, data: { userId: "user-1" } });
    mockCreateSession.mockResolvedValue({ id: "session-1" });

    const res = await jsonPost("/api/auth/register", {
      email: "test@example.com",
      password: "password123",
    });

    const setCookieHeader = res.headers
      .getSetCookie()
      .find((h) => h.includes("session_id"));
    expect(setCookieHeader).toBeDefined();
    expect(setCookieHeader).toContain("HttpOnly");
    expect(setCookieHeader).toContain("SameSite=Lax");
    expect(setCookieHeader).toContain("Path=/");
  });
});
