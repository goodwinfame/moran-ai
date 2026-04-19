/**
 * Usage API routes
 *
 * GET /summary  — Aggregated token usage summary for a project
 * GET /details  — Paginated usage record detail
 *
 * Mounted at /api/projects/:id/usage in app.ts.
 * All routes require authentication (mounted after requireAuth).
 */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { costService } from "@moran/core/services";
import { ok, fail } from "../utils/response.js";

type Variables = { userId: string };

// ── Zod schemas ────────────────────────────────────────────────────────────────

const summaryQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

const detailsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  agentName: z.string().optional(),
  model: z.string().optional(),
});

// ── Route factory ──────────────────────────────────────────────────────────────

export function createUsageRoutes() {
  const usage = new Hono<{ Variables: Variables }>();

  /**
   * GET /api/projects/:id/usage/summary
   * Returns aggregated token and cost summary for the project.
   * Supports ?from= and ?to= ISO date strings for date range filtering.
   */
  usage.get("/summary", zValidator("query", summaryQuerySchema), async (c) => {
    const projectId = c.req.param("id") ?? "";
    const { from, to } = c.req.valid("query");

    const result = await costService.getSummary({ projectId, from, to });
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 500);
    }
    return ok(c, result.data);
  });

  /**
   * GET /api/projects/:id/usage/details
   * Returns paginated usage records with optional filters.
   * Supports ?limit=, ?offset=, ?agentName=, ?model=
   */
  usage.get("/details", zValidator("query", detailsQuerySchema), async (c) => {
    const projectId = c.req.param("id") ?? "";
    const { limit, offset, agentName, model } = c.req.valid("query");

    const result = await costService.getDetails({ projectId, limit, offset, agentName, model });
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 500);
    }
    return ok(c, result.data);
  });

  return usage;
}
