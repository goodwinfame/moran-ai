/**
 * Panel route — Agent Status
 * GET /api/projects/:id/agent-status
 *
 * Returns a snapshot of currently active agents for the given project.
 * Agent status is also pushed in real-time via SSE; this endpoint serves
 * as a fallback snapshot for SSE reconnects.
 */
import { Hono } from "hono";
import { ok, fail } from "../../utils/response.js";
import { agentStateTracker } from "../../sse/index.js";

export function createAgentStatusRoutes() {
  const app = new Hono();

  // GET / → active agent status list
  app.get("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return fail(c, "VALIDATION_ERROR", "Missing project id", 400);
    const agents = agentStateTracker.getActiveAgents(projectId);
    return ok(c, agents);
  });

  return app;
}
