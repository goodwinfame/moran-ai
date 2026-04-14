import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { createAnalysisRoute } from "../analysis.js";

function makeApp() {
  const app = new Hono();
  app.route("/api/projects/:id/analysis", createAnalysisRoute());
  return app;
}

describe("analysis route", () => {
  const PROJECT_ID = "proj-test-1";

  describe("GET /api/projects/:id/analysis", () => {
    it("returns analysis list with demo data", async () => {
      const app = makeApp();
      const res = await app.request(`/api/projects/${PROJECT_ID}/analysis`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.analyses).toBeDefined();
      expect(body.total).toBeGreaterThanOrEqual(2);
      // Demo data includes two analyses
      expect(body.analyses[0].workTitle).toBeDefined();
      expect(body.analyses[0].status).toBe("completed");
    });
  });

  describe("POST /api/projects/:id/analysis", () => {
    it("creates a new analysis with valid input", async () => {
      const app = makeApp();
      // Trigger seeding first
      await app.request(`/api/projects/${PROJECT_ID}/analysis`);

      const res = await app.request(`/api/projects/${PROJECT_ID}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workTitle: "斗破苍穹",
          authorName: "天蚕土豆",
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.work.title).toBe("斗破苍穹");
      expect(body.work.author).toBe("天蚕土豆");
      expect(body.dimensions).toHaveLength(9);
      expect(body.techniques.length).toBeGreaterThan(0);
      expect(body.status).toBe("completed");
    });

    it("rejects empty workTitle", async () => {
      const app = makeApp();
      const res = await app.request(`/api/projects/${PROJECT_ID}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workTitle: "" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/projects/:id/analysis/:analysisId", () => {
    it("returns analysis detail for valid ID", async () => {
      const app = makeApp();
      // Get list first to get an ID
      const listRes = await app.request(`/api/projects/${PROJECT_ID}/analysis`);
      const list = await listRes.json();
      const analysisId = list.analyses[0].id;

      const res = await app.request(`/api/projects/${PROJECT_ID}/analysis/${analysisId}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(analysisId);
      expect(body.dimensions).toHaveLength(9);
      expect(body.overallSummary).toBeDefined();
      expect(body.techniques.length).toBeGreaterThan(0);
    });

    it("returns 404 for unknown ID", async () => {
      const app = makeApp();
      const res = await app.request(`/api/projects/${PROJECT_ID}/analysis/unknown-id`);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/projects/:id/analysis/:analysisId/settle", () => {
    it("settles all techniques when no IDs specified", async () => {
      const app = makeApp();
      // Create analysis
      const createRes = await app.request(`/api/projects/${PROJECT_ID}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workTitle: "测试作品" }),
      });
      const created = await createRes.json();

      const res = await app.request(
        `/api/projects/${PROJECT_ID}/analysis/${created.id}/settle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.settledCount).toBeGreaterThan(0);
      expect(body.totalTechniques).toBeGreaterThan(0);
    });

    it("settles specific techniques by ID", async () => {
      const app = makeApp();
      const createRes = await app.request(`/api/projects/${PROJECT_ID}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workTitle: "测试作品2" }),
      });
      const created = await createRes.json();
      const firstTechId = created.techniques[0].id;

      const res = await app.request(
        `/api/projects/${PROJECT_ID}/analysis/${created.id}/settle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ techniqueIds: [firstTechId] }),
        },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.settledCount).toBe(1);
    });
  });

  describe("GET /api/projects/:id/analysis/:analysisId/export", () => {
    it("exports analysis as markdown", async () => {
      const app = makeApp();
      const listRes = await app.request(`/api/projects/${PROJECT_ID}/analysis`);
      const list = await listRes.json();
      const analysisId = list.analyses[0].id;

      const res = await app.request(`/api/projects/${PROJECT_ID}/analysis/${analysisId}/export`);
      expect(res.status).toBe(200);
      const contentType = res.headers.get("Content-Type");
      expect(contentType).toContain("text/markdown");
      const text = await res.text();
      expect(text).toContain("九维分析报告");
      expect(text).toContain("叙事结构");
    });
  });

  describe("GET /api/projects/:id/analysis/compare", () => {
    it("returns comparison entries for two analyses", async () => {
      const app = makeApp();
      const listRes = await app.request(`/api/projects/${PROJECT_ID}/analysis`);
      const list = await listRes.json();

      // Need at least 2 analyses
      if (list.analyses.length < 2) return;

      const id1 = list.analyses[0].id;
      const id2 = list.analyses[1].id;

      const res = await app.request(
        `/api/projects/${PROJECT_ID}/analysis/compare?ids=${id1},${id2}&dimension=narrative_structure`,
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.entries).toHaveLength(2);
      expect(body.dimension).toBe("narrative_structure");
    });

    it("rejects with less than 2 IDs", async () => {
      const app = makeApp();
      const res = await app.request(
        `/api/projects/${PROJECT_ID}/analysis/compare?ids=one&dimension=narrative_structure`,
      );
      expect(res.status).toBe(400);
    });
  });
});
