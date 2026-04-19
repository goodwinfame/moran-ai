/**
 * Export API routes
 *
 * POST /  — Generate and return project export content
 *
 * Mounted at /api/projects/:id/export in app.ts.
 * All routes require authentication (mounted after requireAuth).
 */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { exportService } from "@moran/core/services";
import { ok, fail } from "../utils/response.js";

type Variables = { userId: string };

// ── Zod schema ─────────────────────────────────────────────────────────────────

const bodySchema = z.object({
  format: z.enum(["txt", "md"]),
  startChapter: z.number().int().positive().optional(),
  endChapter: z.number().int().positive().optional(),
  includeTitle: z.boolean().optional(),
});

// ── Route factory ──────────────────────────────────────────────────────────────

export function createExportRoutes() {
  const exportRouter = new Hono<{ Variables: Variables }>();

  /**
   * POST /api/projects/:id/export
   * Generates export content for all (or a range of) chapters.
   * Returns { content: string, filename: string }.
   */
  exportRouter.post("/", zValidator("json", bodySchema), async (c) => {
    const projectId = c.req.param("id") ?? "";
    const { format, startChapter, endChapter, includeTitle } = c.req.valid("json");

    const result = await exportService.exportProject({
      projectId,
      format,
      startChapter,
      endChapter,
      includeTitle,
    });

    if (!result.ok) {
      const status = result.error.code === "NOT_FOUND" ? 404 : 500;
      return fail(c, result.error.code, result.error.message, status);
    }
    return ok(c, result.data);
  });

  return exportRouter;
}
