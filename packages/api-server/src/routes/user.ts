/**
 * User API routes — profile & global stats
 *
 * All routes are protected by requireAuth middleware mounted in app.ts.
 * userId is injected by requireAuth via c.get("userId").
 */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authService, projectService } from "@moran/core/services";
import { ok, fail } from "../utils/response.js";

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  preferences: z.record(z.unknown()).optional(),
});

export function createUserRoutes() {
  const routes = new Hono<{ Variables: { userId: string } }>();

  // GET /profile — return current user info
  routes.get("/profile", async (c) => {
    const userId = c.get("userId");
    const result = await authService.getUser(userId);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 404);
    }
    return ok(c, result.data);
  });

  // PATCH /profile — update display name / preferences
  routes.patch("/profile", zValidator("json", updateProfileSchema), async (c) => {
    const userId = c.get("userId");
    const body = c.req.valid("json");
    const result = await authService.updateUser(userId, body);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 404);
    }
    return ok(c, result.data);
  });

  // GET /stats — return user global statistics
  routes.get("/stats", async (c) => {
    const userId = c.get("userId");
    const result = await projectService.list(userId);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 500);
    }
    return ok(c, {
      userId,
      totalProjects: result.data.length,
    });
  });

  return routes;
}
