/**
 * Auth middleware — Cookie + DB Session 校验
 *
 * Replaces V1's userIdMiddleware (header-based).
 * Validates session_id cookie against DB, injects userId into context.
 */
import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { authService } from "@moran/core/services";

export const requireAuth = createMiddleware<{
  Variables: { userId: string };
}>(async (c, next) => {
  const sessionId = getCookie(c, "session_id");
  if (!sessionId) {
    return c.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Missing session" } },
      401,
    );
  }

  const result = await authService.validateSession(sessionId);
  if (!result.ok) {
    return c.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Session expired" } },
      401,
    );
  }

  c.set("userId", result.data.userId);
  await next();
});
