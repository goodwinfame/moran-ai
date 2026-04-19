/**
 * Panel route — Agent Status (stub)
 * GET /api/projects/:id/agent-status
 *
 * Agent status is pushed in real-time via SSE (Phase 4.2).
 * This endpoint provides a fallback snapshot for SSE reconnects.
 * Returns empty array until SSE state manager is implemented.
 */
import { Hono } from "hono";
import { ok } from "../../utils/response.js";

export function createAgentStatusRoutes() {
  const app = new Hono();

  // GET / → active agent status list (stub — Phase 4.2 implements SSE state)
  app.get("/", async (_c) => {
    // TODO (Phase 4.2): Return actual agent status from SSE state manager
    return ok(_c, []);
  });

  return app;
}
