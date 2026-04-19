/**
 * Auth routes — register / login / logout
 *
 * These routes are PUBLIC (no requireAuth middleware).
 * Must be mounted BEFORE the requireAuth middleware in app.ts.
 */
import { Hono } from "hono";
import { setCookie, getCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authService } from "@moran/core/services";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "Lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

export function createAuthRoutes() {
  const auth = new Hono();

  // POST /api/auth/register
  auth.post("/register", zValidator("json", registerSchema), async (c) => {
    const body = c.req.valid("json");
    const result = await authService.register(body);
    if (!result.ok) {
      return c.json({ ok: false, error: result.error }, 400);
    }

    const session = await authService.createSession(result.data.userId);
    setCookie(c, "session_id", session.id, COOKIE_OPTIONS);
    return c.json({ ok: true, data: { userId: result.data.userId } }, 201);
  });

  // POST /api/auth/login
  auth.post("/login", zValidator("json", loginSchema), async (c) => {
    const body = c.req.valid("json");
    const result = await authService.login(body);
    if (!result.ok) {
      return c.json({ ok: false, error: result.error }, 401);
    }

    const session = await authService.createSession(result.data.userId);
    setCookie(c, "session_id", session.id, COOKIE_OPTIONS);
    return c.json({ ok: true, data: { userId: result.data.userId } });
  });

  // POST /api/auth/logout
  auth.post("/logout", async (c) => {
    const sessionId = getCookie(c, "session_id");
    if (sessionId) {
      await authService.deleteSession(sessionId);
    }
    setCookie(c, "session_id", "", { ...COOKIE_OPTIONS, maxAge: 0 });
    return c.json({ ok: true });
  });

  return auth;
}
