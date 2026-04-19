/**
 * Panel route — Reviews (stub)
 * GET /api/projects/:id/reviews
 * GET /api/projects/:id/reviews/:chapterNum
 *
 * TODO (Phase 4.2+): reviewService does not yet expose list/read methods.
 * Review data storage needs to be designed before these return real data.
 * Currently returns empty stubs so the panel UI has valid endpoints to call.
 */
import { Hono } from "hono";
import { ok } from "../../utils/response.js";

export function createReviewRoutes() {
  const app = new Hono();

  // GET / → list review reports for project (stub)
  app.get("/", async (_c) => {
    // TODO (Phase 4.2+): implement when reviewService.list is available
    return ok(_c, []);
  });

  // GET /:chapterNum → review report for a specific chapter (stub)
  app.get("/:chapterNum", async (_c) => {
    // TODO (Phase 4.2+): implement when reviewService.read is available
    return ok(_c, { rounds: [] });
  });

  return app;
}
