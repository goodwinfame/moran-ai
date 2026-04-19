/**
 * User API routes — profile & global stats
 *
 * All routes are protected by requireAuth middleware mounted in app.ts.
 * userId is injected by requireAuth via c.get("userId").
 *
 * NOTE: Profile read/write is currently limited because authService does not
 * yet expose a getUser() or updateUser() method. Stubs are returned for those
 * fields; TODO comments mark the gaps.
 */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { projectService } from "@moran/core/services";
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
    // TODO: Call authService.getUser(userId) once the method is available to
    //       return full profile (email, displayName, createdAt, etc.)
    return ok(c, {
      userId,
    });
  });

  // PATCH /profile — update display name / preferences
  routes.patch("/profile", zValidator("json", updateProfileSchema), async (c) => {
    const userId = c.get("userId");
    // TODO: Call authService.updateUser(userId, body) once the method is
    //       available. The body is validated by Zod but not yet persisted.
    //       const body = c.req.valid("json");
    return ok(c, {
      userId,
      updated: true,
    });
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
