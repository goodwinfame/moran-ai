import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";

describe("Reader-review routes", () => {
  const setup = () => {
    const { app } = createApp({});
    return { app };
  };

  describe("GET /api/projects/:id/reader-review", () => {
    it("returns list of reader reviews (demo data seeded)", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/reader-review");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.total).toBe(3);
      expect(body.reviews).toHaveLength(3);

      // List items should have summary fields only
      const first = body.reviews[0];
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("chapterNumber");
      expect(first).toHaveProperty("readabilityScore");
      expect(first).toHaveProperty("oneLiner");
      expect(first).toHaveProperty("createdAt");
      // Should NOT have full detail fields
      expect(first).not.toHaveProperty("boringSpots");
      expect(first).not.toHaveProperty("touchingMoments");
    });

    it("returns reviews sorted by chapter number", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-sorted/reader-review");

      expect(res.status).toBe(200);
      const body = await res.json();
      const chapters = body.reviews.map((r: { chapterNumber: number }) => r.chapterNumber);
      expect(chapters).toEqual([1, 2, 3]);
    });
  });

  describe("GET /api/projects/:id/reader-review/:chapterNum", () => {
    it("returns full reader review for specific chapter", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-2/reader-review/1");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.chapterNumber).toBe(1);
      expect(body.readabilityScore).toBe(7);
      expect(body.oneLiner).toBeTruthy();
      expect(body.boringSpots).toBeInstanceOf(Array);
      expect(body.touchingMoments).toBeInstanceOf(Array);
      expect(body.freeThoughts).toBeTruthy();
    });

    it("seeds demo data for non-existent chapter", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-3/reader-review/42");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.chapterNumber).toBe(42);
      expect(body.readabilityScore).toBe(7);
    });

    it("returns 400 for invalid chapter number", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/reader-review/abc");

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/projects/:id/reader-review", () => {
    it("creates a reader review and returns 201", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-4/reader-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterNumber: 5 }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.chapterNumber).toBe(5);
      expect(body.readabilityScore).toBe(7);
      expect(body.boringSpots).toBeInstanceOf(Array);
    });

    it("returns 400 when chapterNumber missing", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/reader-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid body", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/reader-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json{{{",
      });

      expect(res.status).toBe(400);
    });
  });
});
