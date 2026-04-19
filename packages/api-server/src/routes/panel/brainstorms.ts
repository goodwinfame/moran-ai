/**
 * Panel route — Brainstorms
 * GET /api/projects/:id/brainstorms
 */
import { Hono } from "hono";
import { brainstormService } from "@moran/core/services";
import { ok, fail } from "../../utils/response.js";

export function createBrainstormRoutes() {
  const app = new Hono();

  // GET / → list all brainstorm documents for the project
  app.get("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return fail(c, "VALIDATION_ERROR", "Missing project id", 400);
    const result = await brainstormService.list(projectId);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 500);
    }
    return ok(c, result.data);
  });

  return app;
}
