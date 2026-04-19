/**
 * Panel route — Outline
 * GET /api/projects/:id/outline
 * GET /api/projects/:id/outline/arcs/:arcIndex
 */
import { Hono } from "hono";
import { outlineService } from "@moran/core/services";
import { ok, fail } from "../../utils/response.js";

export function createOutlineRoutes() {
  const app = new Hono();

  // GET / → full outline (outline metadata + all arcs)
  app.get("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return fail(c, "VALIDATION_ERROR", "Missing project id", 400);

    const [outlineResult, arcsResult] = await Promise.all([
      outlineService.readOutline(projectId),
      outlineService.listArcs(projectId),
    ]);

    if (!arcsResult.ok) {
      return fail(c, arcsResult.error.code, arcsResult.error.message, 500);
    }

    // Outline may not exist yet for new projects — return null gracefully
    const outline = outlineResult.ok ? outlineResult.data : null;

    return ok(c, { outline, arcs: arcsResult.data });
  });

  // GET /arcs/:arcIndex → single arc detail
  app.get("/arcs/:arcIndex", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return fail(c, "VALIDATION_ERROR", "Missing project id", 400);
    const arcIndex = parseInt(c.req.param("arcIndex") ?? "", 10);

    if (isNaN(arcIndex)) {
      return fail(c, "VALIDATION_ERROR", "arcIndex must be a number", 400);
    }

    const result = await outlineService.readArc(projectId, arcIndex);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 404);
    }
    return ok(c, result.data);
  });

  return app;
}
