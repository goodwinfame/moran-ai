import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";

describe("Versions routes", () => {
  const setup = () => {
    const { app } = createApp({});
    return { app };
  };

  describe("GET /api/projects/:id/versions/chapters/:num", () => {
    it("returns version list for chapter 1 (demo data)", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/versions/chapters/1");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.chapterNumber).toBe(1);
      expect(body.totalVersions).toBe(3);
      expect(body.passingVersions).toBe(2);
      expect(body.selectedVersion).toBe(2);
      expect(body.versions).toHaveLength(3);

      // Summaries should NOT contain content
      const first = body.versions[0];
      expect(first).not.toHaveProperty("content");
      expect(first).toHaveProperty("versionIndex");
      expect(first).toHaveProperty("score");
      expect(first).toHaveProperty("temperature");
    });

    it("returns 404 for non-existent chapter versions", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/versions/chapters/999");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/projects/:id/versions/chapters/:num/:vIdx", () => {
    it("returns version detail with content", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/versions/chapters/1/2");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.versionIndex).toBe(2);
      expect(body.content).toBeTruthy();
      expect(body.isSelected).toBe(true);
      expect(body.score).toBe(85);
    });

    it("returns 404 for non-existent version index", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/versions/chapters/1/99");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/projects/:id/versions/chapters/:num/select", () => {
    it("selects a different version", async () => {
      const { app } = setup();
      const res = await app.request(
        "/api/projects/proj-select/versions/chapters/1/select",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ versionIndex: 3 }),
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("selected");
      expect(body.selectedVersion).toBe(3);
    });

    it("returns 400 for missing versionIndex", async () => {
      const { app } = setup();
      const res = await app.request(
        "/api/projects/proj-1/versions/chapters/1/select",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent version", async () => {
      const { app } = setup();
      const res = await app.request(
        "/api/projects/proj-1/versions/chapters/1/select",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ versionIndex: 99 }),
        },
      );
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/projects/:id/versions/config", () => {
    it("returns default config", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/versions/config");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.versionCount).toBe(3);
      expect(body.temperaturePerturbation).toBe(0.08);
      expect(body.parallel).toBe(false);
      expect(body.skipFullReview).toBe(false);
      expect(body.enabled).toBe(false);
    });
  });

  describe("PUT /api/projects/:id/versions/config", () => {
    it("updates config with valid values", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-cfg/versions/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionCount: 4,
          parallel: true,
          enabled: true,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.versionCount).toBe(4);
      expect(body.parallel).toBe(true);
      expect(body.enabled).toBe(true);
      // Unchanged fields keep defaults
      expect(body.temperaturePerturbation).toBe(0.08);
      expect(body.skipFullReview).toBe(false);
    });

    it("clamps versionCount to [2, 5]", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-clamp/versions/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionCount: 10 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.versionCount).toBe(5);
    });

    it("clamps temperaturePerturbation to [0, 0.3]", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-clamp2/versions/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temperaturePerturbation: 0.5 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.temperaturePerturbation).toBe(0.3);
    });
  });
});
