/**
 * Panel routes aggregator
 *
 * Aggregates all panel sub-routes and mounts them under a project context.
 * Mount this at /api/projects/:id in app.ts:
 *   app.route("/api/projects/:id", createPanelRoutes())
 */
import { Hono } from "hono";
import { createBrainstormRoutes } from "./brainstorms.js";
import { createWorldSettingsRoutes } from "./world-settings.js";
import { createCharacterRoutes } from "./characters.js";
import { createRelationshipRoutes } from "./relationships.js";
import { createOutlineRoutes } from "./outline.js";
import { createChapterRoutes } from "./chapters.js";
import { createReviewRoutes } from "./reviews.js";
import { createAnalysisRoutes } from "./analysis.js";
import { createKnowledgeRoutes } from "./knowledge.js";
import { createStatsRoutes } from "./stats.js";
import { createAgentStatusRoutes } from "./agent-status.js";

export function createPanelRoutes() {
  const panel = new Hono();

  panel.route("/brainstorms", createBrainstormRoutes());
  panel.route("/world-settings", createWorldSettingsRoutes());
  panel.route("/characters", createCharacterRoutes());
  panel.route("/relationships", createRelationshipRoutes());
  panel.route("/outline", createOutlineRoutes());
  panel.route("/chapters", createChapterRoutes());
  panel.route("/reviews", createReviewRoutes());
  panel.route("/analysis", createAnalysisRoutes());
  panel.route("/knowledge", createKnowledgeRoutes());
  panel.route("/stats", createStatsRoutes());
  panel.route("/agent-status", createAgentStatusRoutes());

  return panel;
}
