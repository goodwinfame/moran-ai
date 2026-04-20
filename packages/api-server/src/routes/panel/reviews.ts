/**
 * Panel route — Reviews
 * GET /api/projects/:id/reviews
 * GET /api/projects/:id/reviews/:chapterNum
 */
import { Hono } from "hono";
import { reviewService } from "@moran/core/services";
import { ok, fail } from "../../utils/response.js";

export function createReviewRoutes() {
  const app = new Hono();

  // GET / → list all review reports for project
  app.get("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return fail(c, "VALIDATION_ERROR", "Missing project id", 400);
    const result = await reviewService.list(projectId);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 500);
    }
    return ok(c, result.data);
  });

  // GET /:chapterNum → all review rounds for a specific chapter
  app.get("/:chapterNum", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return fail(c, "VALIDATION_ERROR", "Missing project id", 400);
    const chapterNum = parseInt(c.req.param("chapterNum") ?? "", 10);
    if (isNaN(chapterNum)) {
      return fail(c, "VALIDATION_ERROR", "Chapter number must be a number", 400);
    }
    const result = await reviewService.readByChapter(projectId, chapterNum);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 500);
    }
    return ok(c, result.data);
  });

  return app;
}
