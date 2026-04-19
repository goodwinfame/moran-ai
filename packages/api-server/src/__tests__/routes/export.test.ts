/**
 * Export API Routes — Integration Tests
 *
 * Tests POST /api/projects/:id/export with mocked exportService.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Service mocks (must be declared before imports) ────────────────────────────

const mockValidateSession = vi.fn();
const mockExportProject = vi.fn();

vi.mock("@moran/core/services", () => ({
  authService: {
    validateSession: (...args: unknown[]) => mockValidateSession(...args),
  },
  exportService: {
    exportProject: (...args: unknown[]) => mockExportProject(...args),
  },
}));

import { createApp } from "../../app.js";
import { createExportRoutes } from "../../routes/export.js";

const { app } = createApp();
app.route("/api/projects/:id/export", createExportRoutes());

// ── Helpers ────────────────────────────────────────────────────────────────────

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: "session_id=test-session", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateSession.mockResolvedValue({ ok: true, data: { userId: "user-1" } });
});

// ── POST /api/projects/:id/export ─────────────────────────────────────────────

describe("POST /api/projects/:id/export", () => {
  it("returns 200 with txt export content", async () => {
    mockExportProject.mockResolvedValue({
      ok: true,
      data: { content: "第 1 章 初遇\n\n第一章内容", filename: "我的小说_export.txt" },
    });

    const res = await post("/api/projects/proj-1/export", { format: "txt" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.filename).toBe("我的小说_export.txt");
    expect(body.data.content).toContain("第 1 章 初遇");
    expect(mockExportProject).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "proj-1", format: "txt" }),
    );
  });

  it("returns 200 with md export content", async () => {
    mockExportProject.mockResolvedValue({
      ok: true,
      data: { content: "# 第 1 章 初遇\n\n第一章内容", filename: "我的小说_export.md" },
    });

    const res = await post("/api/projects/proj-1/export", { format: "md" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.filename).toBe("我的小说_export.md");
    expect(mockExportProject).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "proj-1", format: "md" }),
    );
  });

  it("passes startChapter, endChapter, includeTitle to service", async () => {
    mockExportProject.mockResolvedValue({
      ok: true,
      data: { content: "content", filename: "proj_export.txt" },
    });

    await post("/api/projects/proj-1/export", {
      format: "txt",
      startChapter: 2,
      endChapter: 5,
      includeTitle: false,
    });

    expect(mockExportProject).toHaveBeenCalledWith({
      projectId: "proj-1",
      format: "txt",
      startChapter: 2,
      endChapter: 5,
      includeTitle: false,
    });
  });

  it("returns 400 for invalid format (not txt or md)", async () => {
    const res = await post("/api/projects/proj-1/export", { format: "docx" });

    expect(res.status).toBe(400);
    expect(mockExportProject).not.toHaveBeenCalled();
  });

  it("returns 400 when format is missing", async () => {
    const res = await post("/api/projects/proj-1/export", {});

    expect(res.status).toBe(400);
    expect(mockExportProject).not.toHaveBeenCalled();
  });

  it("returns 404 when service returns NOT_FOUND", async () => {
    mockExportProject.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "没有可导出的章节" },
    });

    const res = await post("/api/projects/proj-1/export", { format: "txt" });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 500 when service returns a non-NOT_FOUND error", async () => {
    mockExportProject.mockResolvedValue({
      ok: false,
      error: { code: "DB_ERROR", message: "数据库连接失败" },
    });

    const res = await post("/api/projects/proj-1/export", { format: "txt" });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("DB_ERROR");
  });

  it("returns 401 without session cookie", async () => {
    const res = await app.request("/api/projects/proj-1/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "txt" }),
    });

    expect(res.status).toBe(401);
  });
});
