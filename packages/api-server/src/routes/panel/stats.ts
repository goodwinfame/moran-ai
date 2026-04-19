/**
 * Panel route — Stats
 * GET /api/projects/:id/stats
 *
 * Aggregates data from multiple services to produce project statistics.
 */
import { Hono } from "hono";
import { chapterService, projectService } from "@moran/core/services";
import { ok, fail } from "../../utils/response.js";

export function createStatsRoutes() {
  const app = new Hono();

  // GET / → aggregate project stats (chapter count, total words, project info)
  app.get("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return fail(c, "VALIDATION_ERROR", "Missing project id", 400);

    const [chaptersResult, projectResult] = await Promise.all([
      chapterService.list(projectId),
      projectService.read(projectId),
    ]);

    if (!chaptersResult.ok) {
      return fail(c, chaptersResult.error.code, chaptersResult.error.message, 500);
    }
    if (!projectResult.ok) {
      return fail(c, projectResult.error.code, projectResult.error.message, 404);
    }

    const chapters = chaptersResult.data;
    const totalChapters = chapters.length;
    const totalWords = chapters.reduce(
      (sum, ch) => sum + (ch.wordCount ?? 0),
      0,
    );

    return ok(c, {
      totalChapters,
      totalWords,
      project: projectResult.data,
    });
  });

  return app;
}
