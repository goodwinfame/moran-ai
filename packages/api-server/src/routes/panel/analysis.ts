/**
 * Panel route — Analysis (stub)
 * GET /api/projects/:id/analysis
 * GET /api/projects/:id/analysis/trend
 * GET /api/projects/:id/analysis/:chapterNum
 *
 * TODO (Phase 4.2+): analysisService does not yet expose list/read methods.
 * Analysis data storage needs to be designed before these return real data.
 * Currently returns empty stubs so the panel UI has valid endpoints to call.
 *
 * NOTE: /trend is defined BEFORE /:chapterNum to avoid it being captured as a
 * dynamic segment.
 */
import { Hono } from "hono";
import { ok } from "../../utils/response.js";

export function createAnalysisRoutes() {
  const app = new Hono();

  // GET /trend → multi-chapter score trend data (stub)
  app.get("/trend", async (_c) => {
    // TODO (Phase 4.2+): implement when analysis data storage is available
    return ok(_c, []);
  });

  // GET / → list analysis reports for project (stub)
  app.get("/", async (_c) => {
    // TODO (Phase 4.2+): implement when analysisService.list is available
    return ok(_c, []);
  });

  // GET /:chapterNum → nine-dimension analysis for a specific chapter (stub)
  app.get("/:chapterNum", async (_c) => {
    // TODO (Phase 4.2+): implement when analysisService.read is available
    return ok(_c, { dimensions: [] });
  });

  return app;
}
