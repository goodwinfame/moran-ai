/**
 * Panel route — Knowledge
 * GET /api/projects/:id/knowledge
 *
 * Supports pagination (?page=1&pageSize=20) and filtering (?category=&keyword=).
 * knowledgeService.list takes (scope, category?) — scope for project entries is
 * `project:{projectId}`. All filtering is done in-memory after fetching.
 */
import { Hono } from "hono";
import { knowledgeService } from "@moran/core/services";
import { paginated, fail } from "../../utils/response.js";

export function createKnowledgeRoutes() {
  const app = new Hono();

  // GET / → paginated knowledge entries for the project
  app.get("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return fail(c, "VALIDATION_ERROR", "Missing project id", 400);

    const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(c.req.query("pageSize") ?? "20", 10) || 20),
    );
    const category = c.req.query("category");
    const keyword = c.req.query("keyword");

    // Project-scoped knowledge entries
    const scope = `project:${projectId}`;
    const result = await knowledgeService.list(scope);
    if (!result.ok) {
      return fail(c, result.error.code, result.error.message, 500);
    }

    let data = result.data;

    // In-memory filtering
    if (category) {
      data = data.filter((entry) => entry.category === category);
    }
    if (keyword) {
      data = data.filter(
        (entry) =>
          (entry.title ?? "").includes(keyword) ||
          (entry.content ?? "").includes(keyword),
      );
    }

    // In-memory pagination
    const total = data.length;
    const offset = (page - 1) * pageSize;
    const sliced = data.slice(offset, offset + pageSize);

    return paginated(c, sliced, {
      total,
      page,
      pageSize,
      hasMore: offset + pageSize < total,
    });
  });

  return app;
}
