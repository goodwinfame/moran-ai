import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";

describe("Diagnosis routes", () => {
  const setup = () => {
    const { app } = createApp({});
    return { app };
  };

  describe("GET /api/projects/:id/diagnosis", () => {
    it("returns list of diagnoses (demo data seeded)", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/diagnosis");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.total).toBe(2);
      expect(body.diagnoses).toHaveLength(2);

      // List items should have summary fields only
      const first = body.diagnoses[0];
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("chapterNumber");
      expect(first).toHaveProperty("coreIssueCount");
      expect(first).toHaveProperty("topIssueSeverity");
      expect(first).toHaveProperty("summary");
      expect(first).toHaveProperty("createdAt");
      // Should NOT have full detail fields
      expect(first).not.toHaveProperty("dimensionDiagnoses");
      expect(first).not.toHaveProperty("coreIssues");
    });

    it("returns diagnoses sorted by chapter number", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-diag-sort/diagnosis");

      expect(res.status).toBe(200);
      const body = await res.json();
      const chapters = body.diagnoses.map((d: { chapterNumber: number }) => d.chapterNumber);
      expect(chapters).toEqual([1, 2]);
    });
  });

  describe("GET /api/projects/:id/diagnosis/:chapterNum", () => {
    it("returns full diagnosis for specific chapter", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-2/diagnosis/1");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.chapterNumber).toBe(1);
      expect(body.dimensionDiagnoses).toBeInstanceOf(Array);
      expect(body.dimensionDiagnoses.length).toBe(5);
      expect(body.coreIssues).toBeInstanceOf(Array);
      expect(body.coreIssues.length).toBeGreaterThan(0);
      expect(body.summary).toBeTruthy();

      // Verify dimension structure
      const dim = body.dimensionDiagnoses[0];
      expect(dim).toHaveProperty("dimension");
      expect(dim).toHaveProperty("label");
      expect(dim).toHaveProperty("severity");
      expect(dim).toHaveProperty("rootCause");
      expect(dim).toHaveProperty("improvementDirection");
    });

    it("seeds demo data for non-existent chapter", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-3/diagnosis/99");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.chapterNumber).toBe(99);
      expect(body.dimensionDiagnoses).toHaveLength(5);
    });

    it("returns 400 for invalid chapter number", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/diagnosis/xyz");

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/projects/:id/diagnosis", () => {
    it("creates a diagnosis and returns 201", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-4/diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterNumber: 3 }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.chapterNumber).toBe(3);
      expect(body.dimensionDiagnoses).toHaveLength(5);
      expect(body.coreIssues).toBeInstanceOf(Array);
    });

    it("accepts optional reviewSummary field", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-5/diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterNumber: 1, reviewSummary: "Some context" }),
      });

      expect(res.status).toBe(201);
    });

    it("returns 400 when chapterNumber missing", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid body", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json{",
      });

      expect(res.status).toBe(400);
    });
  });
});
