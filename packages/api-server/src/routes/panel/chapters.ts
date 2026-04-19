/**
 * Panel route — Chapters
 * GET /api/projects/:id/chapters
 * GET /api/projects/:id/chapters/:num
 * GET /api/projects/:id/chapters/:num/versions
 */
import { Hono } from "hono";
import { chapterService } from "@moran/core/services";
import { ok, fail } from "../../utils/response.js";

export function createChapterRoutes() {
  const app = new Hono();

  // GET / → list all chapters for project
  app.get("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return fail(c, "VALIDATION_ERROR", "Missing project id", 400);

    const result = await chapterService.list(projectId);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 500);
    }
    return ok(c, result.data);
  });

  // GET /:num → single chapter by chapter number
  app.get("/:num", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return fail(c, "VALIDATION_ERROR", "Missing project id", 400);
    const num = parseInt(c.req.param("num") ?? "", 10);

    if (isNaN(num)) {
      return fail(c, "VALIDATION_ERROR", "Chapter number must be a number", 400);
    }

    const result = await chapterService.read(projectId, num);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 404);
    }
    return ok(c, result.data);
  });

  // GET /:num/versions → version history for a chapter
  app.get("/:num/versions", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return fail(c, "VALIDATION_ERROR", "Missing project id", 400);
    const num = parseInt(c.req.param("num") ?? "", 10);

    if (isNaN(num)) {
      return fail(c, "VALIDATION_ERROR", "Chapter number must be a number", 400);
    }

    // Resolve chapter id first, then fetch versions
    const chapterResult = await chapterService.read(projectId, num);
    if (!chapterResult.ok) {
      return fail(c, chapterResult.error.code, chapterResult.error.message, 404);
    }

    const versionsResult = await chapterService.listVersions(chapterResult.data.id);
    if (!versionsResult.ok) {
      return fail(c, versionsResult.error.code, versionsResult.error.message, 500);
    }
    return ok(c, versionsResult.data);
  });

  return app;
}
