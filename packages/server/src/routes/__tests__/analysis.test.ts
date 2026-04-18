import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { SessionProjectBridge, XidianEngine } from "@moran/core";
import { createAnalysisRoute } from "../analysis.js";

function makeApp() {
  const bridge = new SessionProjectBridge();
  const xidianEngine = new XidianEngine();
  const app = new Hono();
  app.route("/api/projects/:id/analysis", createAnalysisRoute(bridge, xidianEngine));
  return app;
}

describe("analysis route", () => {
  const PROJECT_ID = "proj-test-1";

  describe("GET /api/projects/:id/analysis", () => {
    it("returns empty analysis list when no data exists", async () => {
      const app = makeApp();
      const res = await app.request(`/api/projects/${PROJECT_ID}/analysis`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.analyses).toBeDefined();
      expect(Array.isArray(body.analyses)).toBe(true);
      expect(typeof body.total).toBe("number");
    });
  });

  describe("POST /api/projects/:id/analysis", () => {
    it("creates a new analysis task and returns 202 pending", async () => {
      const app = makeApp();
      const res = await app.request(`/api/projects/${PROJECT_ID}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workTitle: "斗破苍穹",
          authorName: "天蚕土豆",
        }),
      });
      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.work.title).toBe("斗破苍穹");
      expect(body.work.author).toBe("天蚕土豆");
      expect(body.status).toBe("pending");
      expect(body.dimensions).toHaveLength(0);
      expect(body.overallSummary).toBe("");
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

    it("rejects missing workTitle", async () => {
      const app = makeApp();
      const res = await app.request(`/api/projects/${PROJECT_ID}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/projects/:id/analysis/:analysisId", () => {
    it("returns 404 for unknown ID", async () => {
      const app = makeApp();
      const res = await app.request(`/api/projects/${PROJECT_ID}/analysis/unknown-id`);
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/projects/:id/analysis/compare", () => {
    it("rejects with less than 2 IDs", async () => {
      const app = makeApp();
      const res = await app.request(
        `/api/projects/${PROJECT_ID}/analysis/compare?ids=one&dimension=narrative_structure`,
      );
      expect(res.status).toBe(400);
    });

    it("rejects with missing dimension", async () => {
      const app = makeApp();
      const res = await app.request(
        `/api/projects/${PROJECT_ID}/analysis/compare?ids=one,two`,
      );
      expect(res.status).toBe(400);
    });
  });
});
