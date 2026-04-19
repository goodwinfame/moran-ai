/**
 * Project CRUD routes
 *
 * All routes are protected by requireAuth middleware mounted in app.ts.
 * userId is injected by requireAuth via c.get("userId").
 */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { projectService } from "@moran/core/services";
import { ok, fail } from "../utils/response.js";

const createProjectSchema = z.object({
  title: z.string().min(1).max(500),
  genre: z.string().max(100).optional(),
  subGenre: z.string().max(100).optional(),
});

const PROJECT_STATUSES = ["brainstorm", "world", "character", "outline", "writing", "completed"] as const;

const updateProjectSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  genre: z.string().max(100).optional(),
  subGenre: z.string().max(100).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
});

function errorStatus(code: string): 400 | 401 | 403 | 404 | 500 {
  if (code === "NOT_FOUND") return 404;
  if (code === "UNAUTHORIZED") return 401;
  if (code === "FORBIDDEN") return 403;
  if (code === "INTERNAL_ERROR") return 500;
  return 400;
}

export function createProjectRoutes() {
  const routes = new Hono<{ Variables: { userId: string } }>();

  // GET / — list projects for current user
  routes.get("/", async (c) => {
    const userId = c.get("userId");
    const result = await projectService.list(userId);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, errorStatus(result.error.code));
    }
    return ok(c, result.data);
  });

  // POST / — create project
  routes.post("/", zValidator("json", createProjectSchema), async (c) => {
    const body = c.req.valid("json");
    const userId = c.get("userId");
    const result = await projectService.create({ ...body, userId });
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, errorStatus(result.error.code));
    }
    return ok(c, result.data, 201);
  });

  // GET /:id — get project details
  routes.get("/:id", async (c) => {
    const id = c.req.param("id");
    const result = await projectService.read(id);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, errorStatus(result.error.code));
    }
    return ok(c, result.data);
  });

  // PATCH /:id — update project
  routes.patch("/:id", zValidator("json", updateProjectSchema), async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const result = await projectService.update(id, body);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, errorStatus(result.error.code));
    }
    return ok(c, result.data);
  });

  // DELETE /:id — delete project
  routes.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const result = await projectService.remove(id);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, errorStatus(result.error.code));
    }
    return ok(c, null);
  });

  return routes;
}
