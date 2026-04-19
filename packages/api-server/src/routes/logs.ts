/**
 * Log query API routes
 *
 * GET /  — Paginated query of agent logs for a project
 *
 * Mounted at /api/projects/:id/logs in app.ts.
 * All routes require authentication (mounted after requireAuth).
 */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { logService } from "@moran/core/services";
import { ok, fail } from "../utils/response.js";

type Variables = { userId: string };

// ── Zod schemas ────────────────────────────────────────────────────────────────

const querySchema = z.object({
  category: z.string().optional(),
  level: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ── Route factory ──────────────────────────────────────────────────────────────

export function createLogRoutes() {
  const logs = new Hono<{ Variables: Variables }>();

  /**
   * GET /api/projects/:id/logs
   * Returns paginated agent logs with optional category and level filters.
   * Supports ?category=, ?level=, ?limit=, ?offset=
   */
  logs.get("/", zValidator("query", querySchema), async (c) => {
    const projectId = c.req.param("id") ?? "";
    const { category, level, limit, offset } = c.req.valid("query");

    const result = await logService.query({ projectId, category, level, limit, offset });
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 500);
    }
    return ok(c, result.data);
  });

  return logs;
}
