/**
 * Panel route — World Settings
 * GET /api/projects/:id/world-settings
 * GET /api/projects/:id/world-settings/search
 * GET /api/projects/:id/world-settings/:settingId
 *
 * NOTE: /search is defined BEFORE /:settingId to avoid collision.
 * Hono prioritises static segments, but explicit ordering is clearer.
 */
import { Hono } from "hono";
import { worldService } from "@moran/core/services";
import { ok, fail } from "../../utils/response.js";

export function createWorldSettingsRoutes() {
  const app = new Hono();

  // GET /search → full-text filter on content (basic in-memory)
  app.get("/search", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return fail(c, "VALIDATION_ERROR", "Missing project id", 400);
    const q = c.req.query("q") ?? "";

    const result = await worldService.listSettings(projectId);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 500);
    }

    const filtered = q
      ? result.data.filter(
          (s) =>
            (s.content ?? "").includes(q) ||
            (s.name ?? "").includes(q),
        )
      : result.data;

    return ok(c, filtered);
  });

  // GET / → list settings, optionally filtered by ?section=
  app.get("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return fail(c, "VALIDATION_ERROR", "Missing project id", 400);
    const section = c.req.query("section");

    const result = await worldService.listSettings(projectId, section);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 500);
    }
    return ok(c, result.data);
  });

  // GET /:settingId → single world setting detail
  app.get("/:settingId", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return fail(c, "VALIDATION_ERROR", "Missing project id", 400);
    const settingId = c.req.param("settingId");
    if (!settingId) return fail(c, "VALIDATION_ERROR", "Missing setting id", 400);

    const result = await worldService.readSetting(projectId, settingId);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 404);
    }
    return ok(c, result.data);
  });

  return app;
}
