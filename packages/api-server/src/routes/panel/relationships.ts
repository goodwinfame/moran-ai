/**
 * Panel route — Relationships
 * GET /api/projects/:id/relationships
 *
 * Separate from characters because it's mounted at /relationships, not /characters.
 */
import { Hono } from "hono";
import { relationshipService } from "@moran/core/services";
import { ok, fail } from "../../utils/response.js";

export function createRelationshipRoutes() {
  const app = new Hono();

  // GET / → list all character relationships for the project
  app.get("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return fail(c, "VALIDATION_ERROR", "Missing project id", 400);

    const result = await relationshipService.list(projectId);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 500);
    }
    return ok(c, result.data);
  });

  return app;
}
