/**
 * Panel route — Characters
 * GET /api/projects/:id/characters
 * GET /api/projects/:id/characters/:charId
 * GET /api/projects/:id/characters/:charId/states
 */
import { Hono } from "hono";
import { characterService } from "@moran/core/services";
import { ok, fail } from "../../utils/response.js";

export function createCharacterRoutes() {
  const app = new Hono();

  // GET / → list characters with optional ?role= and ?tier= filters (in-memory)
  app.get("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return fail(c, "VALIDATION_ERROR", "Missing project id", 400);
    const role = c.req.query("role");
    const tier = c.req.query("tier");

    const result = await characterService.list(projectId);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 500);
    }

    let data = result.data;
    if (role) data = data.filter((ch) => ch.role === role);
    if (tier) data = data.filter((ch) => ch.designTier === tier);

    return ok(c, data);
  });

  // GET /:charId → character detail, merged with DNA if available
  app.get("/:charId", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return fail(c, "VALIDATION_ERROR", "Missing project id", 400);
    const charId = c.req.param("charId");
    if (!charId) return fail(c, "VALIDATION_ERROR", "Missing character id", 400);

    const result = await characterService.read(projectId, charId);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 404);
    }

    const dnaResult = await characterService.readDna(charId);
    const dna = dnaResult.ok ? dnaResult.data : null;

    return ok(c, { ...result.data, dna });
  });

  // GET /:charId/states → character state history across chapters
  app.get("/:charId/states", async (c) => {
    const charId = c.req.param("charId");
    if (!charId) return fail(c, "VALIDATION_ERROR", "Missing character id", 400);

    const result = await characterService.listStates(charId);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 500);
    }
    return ok(c, result.data);
  });

  return app;
}
