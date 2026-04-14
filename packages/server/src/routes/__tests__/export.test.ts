import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";

describe("Export routes", () => {
  const setup = () => {
    const { app } = createApp({});
    return { app };
  };

  // ── GET /formats ────────────────────────────────────────

  describe("GET /api/projects/:id/export/formats", () => {
    it("returns list of supported formats", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/export/formats");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.formats).toBeInstanceOf(Array);
      expect(body.formats.length).toBe(3);

      const ids = body.formats.map((f: { id: string }) => f.id);
      expect(ids).toContain("epub");
      expect(ids).toContain("txt");
      expect(ids).toContain("markdown");
    });

    it("each format has required fields", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/export/formats");

      const body = await res.json();
      for (const fmt of body.formats) {
        expect(fmt).toHaveProperty("id");
        expect(fmt).toHaveProperty("label");
        expect(fmt).toHaveProperty("mimeType");
        expect(fmt).toHaveProperty("extension");
      }
    });
  });

  // ── GET /:format — TXT ──────────────────────────────────

  describe("GET /api/projects/:id/export/txt", () => {
    it("returns TXT file with correct headers", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/export/txt");

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/plain");
      expect(res.headers.get("content-disposition")).toContain("attachment");
      expect(res.headers.get("content-disposition")).toContain("filename*=UTF-8''");

      const text = await res.text();
      expect(text).toContain("\u4ED9\u9014");
      expect(text).toContain("\u7B2C1\u7AE0");
      expect(text).toContain("\u7B2C2\u7AE0");
      expect(text).toContain("\u7B2C3\u7AE0");
    });

    it("supports range filtering with start param", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/export/txt?start=2");

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).not.toContain("\u7B2C1\u7AE0 \u521D\u5165\u4FEE\u4ED9\u754C");
      expect(text).toContain("\u7B2C2\u7AE0");
      expect(text).toContain("\u7B2C3\u7AE0");
    });

    it("supports range filtering with end param", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-2/export/txt?end=2");

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("\u7B2C1\u7AE0");
      expect(text).toContain("\u7B2C2\u7AE0");
      expect(text).not.toContain("\u7B2C3\u7AE0 \u7075\u6839\u4E4B\u8C1C");
    });

    it("supports range filtering with both start and end", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-3/export/txt?start=2&end=2");

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("\u7B2C2\u7AE0");
      expect(text).not.toContain("\u7B2C1\u7AE0 \u521D\u5165\u4FEE\u4ED9\u754C");
      expect(text).not.toContain("\u7B2C3\u7AE0 \u7075\u6839\u4E4B\u8C1C");
    });
  });

  // ── GET /:format — Markdown ─────────────────────────────

  describe("GET /api/projects/:id/export/markdown", () => {
    it("returns Markdown file with correct headers", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-4/export/markdown");

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/markdown");
      expect(res.headers.get("content-disposition")).toContain("attachment");

      const md = await res.text();
      expect(md).toContain("# \u4ED9\u9014");
      expect(md).toContain("## \u76EE\u5F55");
      expect(md).toContain("## \u7B2C1\u7AE0 \u521D\u5165\u4FEE\u4ED9\u754C");
      expect(md).toContain("## \u7B2C2\u7AE0 \u62DC\u5E08\u4E4B\u8DEF");
    });

    it("includes table of contents with anchors", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-5/export/markdown");

      const md = await res.text();
      expect(md).toContain("[");
      expect(md).toContain("](#chapter-1)");
      expect(md).toContain("](#chapter-2)");
    });

    it("includes word count per chapter", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-6/export/markdown");

      const md = await res.text();
      // Should contain word count annotations
      expect(md).toMatch(/\u672C\u7AE0\u5B57\u6570/);
    });
  });

  // ── GET /:format — EPUB ─────────────────────────────────

  describe("GET /api/projects/:id/export/epub", () => {
    it("returns EPUB file with correct MIME type", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-7/export/epub");

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/epub+zip");
      expect(res.headers.get("content-disposition")).toContain("attachment");
      expect(res.headers.get("content-disposition")).toContain(".epub");

      // EPUB is a ZIP file — check for PK magic bytes
      const buf = await res.arrayBuffer();
      const view = new Uint8Array(buf);
      expect(view[0]).toBe(0x50); // 'P'
      expect(view[1]).toBe(0x4b); // 'K'
      expect(buf.byteLength).toBeGreaterThan(0);
    });

    it("supports range params for EPUB", async () => {
      const { app } = setup();
      const full = await app.request("/api/projects/proj-8/export/epub");
      const partial = await app.request("/api/projects/proj-9/export/epub?start=2&end=2");

      expect(full.status).toBe(200);
      expect(partial.status).toBe(200);

      // Partial should be smaller than full
      const fullBuf = await full.arrayBuffer();
      const partialBuf = await partial.arrayBuffer();
      expect(partialBuf.byteLength).toBeLessThan(fullBuf.byteLength);
    });
  });

  // ── Error cases ─────────────────────────────────────────

  describe("Error handling", () => {
    it("returns 400 for unsupported format", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/export/pdf");

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Unsupported format");
      expect(body.error).toContain("epub");
      expect(body.error).toContain("txt");
      expect(body.error).toContain("markdown");
    });

    it("returns 400 for invalid start param", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/export/txt?start=abc");

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Invalid start");
    });

    it("returns 400 for invalid end param", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/export/txt?end=xyz");

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Invalid end");
    });
  });
});
