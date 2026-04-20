/**
 * Panel route — Analysis
 * GET /api/projects/:id/analysis
 * GET /api/projects/:id/analysis/trend
 * GET /api/projects/:id/analysis/:chapterNum
 *
 * NOTE: /trend is defined BEFORE /:chapterNum to avoid it being captured as a
 * dynamic segment.
 *
 * NOTE: GET /:chapterNum returns all chapter-scoped analysis reports. The
 * analysisService.list() only supports scope/latest filters, so we query with
 * scope="chapter" and return all matches. The client can filter by chapterNum
 * using the range field in each document's metadata.
 */
import { Hono } from "hono";
import { analysisService } from "@moran/core/services";
import { ok, fail } from "../../utils/response.js";

export function createAnalysisRoutes() {
  const app = new Hono();

  // GET /trend → multi-chapter score trend data
  app.get("/trend", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return fail(c, "VALIDATION_ERROR", "Missing project id", 400);
    const result = await analysisService.trend(projectId);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 500);
    }
    return ok(c, result.data);
  });

  // GET / → list analysis reports for project (optional ?scope= filter)
  app.get("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return fail(c, "VALIDATION_ERROR", "Missing project id", 400);
    const scopeQuery = c.req.query("scope");
    const result = await analysisService.list(projectId, scopeQuery ? { scope: scopeQuery } : undefined);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 500);
    }
    return ok(c, result.data);
  });

  // GET /:chapterNum → chapter-scoped analysis reports
  // Returns all analyses with scope="chapter". Client filters by chapterNum via metadata.range.
  app.get("/:chapterNum", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return fail(c, "VALIDATION_ERROR", "Missing project id", 400);
    const chapterNum = parseInt(c.req.param("chapterNum") ?? "", 10);
    if (isNaN(chapterNum)) {
      return fail(c, "VALIDATION_ERROR", "Chapter number must be a number", 400);
    }
    const result = await analysisService.list(projectId, { scope: "chapter" });
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 500);
    }
    return ok(c, result.data);
  });

  return app;
}
