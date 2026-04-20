/**
 * Panel Routes — Integration Tests
 *
 * Tests all panel sub-routes (T6–T9) with mocked services.
 * Uses createApp() + manually-mounted panel routes + app.request().
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Service mocks (must be declared before imports) ─────────────────────────

const mockValidateSession = vi.fn();
const mockBrainstormList = vi.fn();
const mockWorldListSettings = vi.fn();
const mockWorldReadSetting = vi.fn();
const mockCharacterList = vi.fn();
const mockCharacterRead = vi.fn();
const mockCharacterReadDna = vi.fn();
const mockCharacterListStates = vi.fn();
const mockRelationshipList = vi.fn();
const mockOutlineReadOutline = vi.fn();
const mockOutlineListArcs = vi.fn();
const mockOutlineReadArc = vi.fn();
const mockChapterList = vi.fn();
const mockChapterRead = vi.fn();
const mockChapterListVersions = vi.fn();
const mockKnowledgeList = vi.fn();
const mockProjectRead = vi.fn();
const mockReviewList = vi.fn();
const mockReviewReadByChapter = vi.fn();
const mockAnalysisList = vi.fn();
const mockAnalysisTrend = vi.fn();

vi.mock("@moran/core/services", () => ({
  authService: {
    validateSession: (...args: unknown[]) => mockValidateSession(...args),
  },
  brainstormService: {
    list: (...args: unknown[]) => mockBrainstormList(...args),
  },
  worldService: {
    listSettings: (...args: unknown[]) => mockWorldListSettings(...args),
    readSetting: (...args: unknown[]) => mockWorldReadSetting(...args),
  },
  characterService: {
    list: (...args: unknown[]) => mockCharacterList(...args),
    read: (...args: unknown[]) => mockCharacterRead(...args),
    readDna: (...args: unknown[]) => mockCharacterReadDna(...args),
    listStates: (...args: unknown[]) => mockCharacterListStates(...args),
  },
  relationshipService: {
    list: (...args: unknown[]) => mockRelationshipList(...args),
  },
  outlineService: {
    readOutline: (...args: unknown[]) => mockOutlineReadOutline(...args),
    listArcs: (...args: unknown[]) => mockOutlineListArcs(...args),
    readArc: (...args: unknown[]) => mockOutlineReadArc(...args),
  },
  chapterService: {
    list: (...args: unknown[]) => mockChapterList(...args),
    read: (...args: unknown[]) => mockChapterRead(...args),
    listVersions: (...args: unknown[]) => mockChapterListVersions(...args),
  },
  knowledgeService: {
    list: (...args: unknown[]) => mockKnowledgeList(...args),
  },
  projectService: {
    read: (...args: unknown[]) => mockProjectRead(...args),
  },
  reviewService: {
    list: (...args: unknown[]) => mockReviewList(...args),
    readByChapter: (...args: unknown[]) => mockReviewReadByChapter(...args),
  },
  analysisService: {
    list: (...args: unknown[]) => mockAnalysisList(...args),
    trend: (...args: unknown[]) => mockAnalysisTrend(...args),
  },
}));

import { createApp } from "../../app.js";
import { createPanelRoutes } from "../../routes/panel/index.js";

// Build app once — panel routes added after createApp (Hono allows this)
const { app } = createApp();
app.route("/api/projects/:id", createPanelRoutes());

// ── Helpers ──────────────────────────────────────────────────────────────────

const SESSION_COOKIE = "Cookie: session_id=test-session";

function get(path: string, extra: Record<string, string> = {}) {
  return app.request(path, {
    method: "GET",
    headers: { Cookie: "session_id=test-session", ...extra },
  });
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: valid session for every test
  mockValidateSession.mockResolvedValue({ ok: true, data: { userId: "user-1" } });
});

// ── Brainstorms ──────────────────────────────────────────────────────────────

describe("GET /api/projects/:id/brainstorms", () => {
  it("returns brainstorm list on success", async () => {
    const docs = [{ id: "b1", content: "idea one" }];
    mockBrainstormList.mockResolvedValue({ ok: true, data: docs });

    const res = await get("/api/projects/proj-1/brainstorms");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual(docs);
    expect(mockBrainstormList).toHaveBeenCalledWith("proj-1");
  });

  it("returns 500 when service fails", async () => {
    mockBrainstormList.mockResolvedValue({
      ok: false,
      error: { code: "DB_ERROR", message: "db down" },
    });

    const res = await get("/api/projects/proj-1/brainstorms");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("DB_ERROR");
  });

  it("returns 401 without session cookie", async () => {
    const res = await app.request("/api/projects/proj-1/brainstorms");
    expect(res.status).toBe(401);
  });
});

// ── World Settings ───────────────────────────────────────────────────────────

describe("GET /api/projects/:id/world-settings", () => {
  it("returns all settings", async () => {
    const settings = [{ id: "ws1", section: "geography", content: "mountains" }];
    mockWorldListSettings.mockResolvedValue({ ok: true, data: settings });

    const res = await get("/api/projects/proj-1/world-settings");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual(settings);
  });

  it("passes ?section filter to service", async () => {
    mockWorldListSettings.mockResolvedValue({ ok: true, data: [] });

    await get("/api/projects/proj-1/world-settings?section=magic");
    expect(mockWorldListSettings).toHaveBeenCalledWith("proj-1", "magic");
  });

  it("returns 500 when service fails", async () => {
    mockWorldListSettings.mockResolvedValue({
      ok: false,
      error: { code: "DB_ERROR", message: "error" },
    });

    const res = await get("/api/projects/proj-1/world-settings");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/projects/:id/world-settings/:settingId", () => {
  it("returns a single setting", async () => {
    const setting = { id: "ws1", section: "geography", content: "mountains" };
    mockWorldReadSetting.mockResolvedValue({ ok: true, data: setting });

    const res = await get("/api/projects/proj-1/world-settings/ws1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(setting);
    expect(mockWorldReadSetting).toHaveBeenCalledWith("proj-1", "ws1");
  });

  it("returns 404 when setting not found", async () => {
    mockWorldReadSetting.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "世界设定不存在" },
    });

    const res = await get("/api/projects/proj-1/world-settings/missing");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("GET /api/projects/:id/world-settings/search", () => {
  it("filters settings by ?q= in content", async () => {
    const settings = [
      { id: "ws1", content: "magic system rules", name: "Magic" },
      { id: "ws2", content: "geography description", name: "Map" },
    ];
    mockWorldListSettings.mockResolvedValue({ ok: true, data: settings });

    const res = await get("/api/projects/proj-1/world-settings/search?q=magic");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // Only the magic entry should survive the filter
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("ws1");
  });

  it("returns all settings when ?q= is empty", async () => {
    const settings = [
      { id: "ws1", content: "magic", name: "Magic" },
      { id: "ws2", content: "geography", name: "Map" },
    ];
    mockWorldListSettings.mockResolvedValue({ ok: true, data: settings });

    const res = await get("/api/projects/proj-1/world-settings/search");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
  });
});

// ── Characters ───────────────────────────────────────────────────────────────

describe("GET /api/projects/:id/characters", () => {
  it("returns character list", async () => {
    const chars = [
      { id: "c1", name: "Alice", role: "protagonist", designTier: "核心层" },
      { id: "c2", name: "Bob", role: "supporting", designTier: "支撑层" },
    ];
    mockCharacterList.mockResolvedValue({ ok: true, data: chars });

    const res = await get("/api/projects/proj-1/characters");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(chars);
  });

  it("filters by ?role= in-memory", async () => {
    const chars = [
      { id: "c1", name: "Alice", role: "protagonist", designTier: "核心层" },
      { id: "c2", name: "Bob", role: "supporting", designTier: "支撑层" },
    ];
    mockCharacterList.mockResolvedValue({ ok: true, data: chars });

    const res = await get("/api/projects/proj-1/characters?role=protagonist");
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("c1");
  });

  it("returns 500 when service fails", async () => {
    mockCharacterList.mockResolvedValue({
      ok: false,
      error: { code: "DB_ERROR", message: "error" },
    });

    const res = await get("/api/projects/proj-1/characters");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/projects/:id/characters/:charId", () => {
  it("returns character with DNA merged in", async () => {
    const char = { id: "c1", name: "Alice", role: "protagonist" };
    const dna = { characterId: "c1", ghost: "lost family", lie: "nobody cares" };
    mockCharacterRead.mockResolvedValue({ ok: true, data: char });
    mockCharacterReadDna.mockResolvedValue({ ok: true, data: dna });

    const res = await get("/api/projects/proj-1/characters/c1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("c1");
    expect(body.data.dna).toEqual(dna);
  });

  it("returns character with dna=null when DNA missing", async () => {
    const char = { id: "c1", name: "Alice" };
    mockCharacterRead.mockResolvedValue({ ok: true, data: char });
    mockCharacterReadDna.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "DNA not found" },
    });

    const res = await get("/api/projects/proj-1/characters/c1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.dna).toBeNull();
  });

  it("returns 404 when character not found", async () => {
    mockCharacterRead.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "角色不存在" },
    });

    const res = await get("/api/projects/proj-1/characters/missing");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/projects/:id/characters/:charId/states", () => {
  it("returns character state history", async () => {
    const states = [{ id: "s1", chapterNumber: 1, summary: "cheerful" }];
    mockCharacterListStates.mockResolvedValue({ ok: true, data: states });

    const res = await get("/api/projects/proj-1/characters/c1/states");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(states);
    expect(mockCharacterListStates).toHaveBeenCalledWith("c1");
  });
});

// ── Relationships ────────────────────────────────────────────────────────────

describe("GET /api/projects/:id/relationships", () => {
  it("returns relationship list", async () => {
    const rels = [{ id: "r1", sourceId: "c1", targetId: "c2", type: "ally" }];
    mockRelationshipList.mockResolvedValue({ ok: true, data: rels });

    const res = await get("/api/projects/proj-1/relationships");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(rels);
    expect(mockRelationshipList).toHaveBeenCalledWith("proj-1");
  });

  it("returns 500 when service fails", async () => {
    mockRelationshipList.mockResolvedValue({
      ok: false,
      error: { code: "DB_ERROR", message: "error" },
    });

    const res = await get("/api/projects/proj-1/relationships");
    expect(res.status).toBe(500);
  });
});

// ── Outline ──────────────────────────────────────────────────────────────────

describe("GET /api/projects/:id/outline", () => {
  it("returns outline and arcs", async () => {
    const outline = { id: "o1", synopsis: "A hero rises" };
    const arcs = [{ id: "a1", arcIndex: 0, title: "Act 1" }];
    mockOutlineReadOutline.mockResolvedValue({ ok: true, data: outline });
    mockOutlineListArcs.mockResolvedValue({ ok: true, data: arcs });

    const res = await get("/api/projects/proj-1/outline");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.outline).toEqual(outline);
    expect(body.data.arcs).toEqual(arcs);
  });

  it("returns outline=null when outline not found yet", async () => {
    mockOutlineReadOutline.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "大纲不存在" },
    });
    mockOutlineListArcs.mockResolvedValue({ ok: true, data: [] });

    const res = await get("/api/projects/proj-1/outline");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.outline).toBeNull();
    expect(body.data.arcs).toEqual([]);
  });
});

describe("GET /api/projects/:id/outline/arcs/:arcIndex", () => {
  it("returns single arc", async () => {
    const arc = { id: "a1", arcIndex: 0, title: "Act 1" };
    mockOutlineReadArc.mockResolvedValue({ ok: true, data: arc });

    const res = await get("/api/projects/proj-1/outline/arcs/0");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(arc);
    expect(mockOutlineReadArc).toHaveBeenCalledWith("proj-1", 0);
  });

  it("returns 404 when arc not found", async () => {
    mockOutlineReadArc.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "弧段不存在" },
    });

    const res = await get("/api/projects/proj-1/outline/arcs/99");
    expect(res.status).toBe(404);
  });

  it("returns 400 for non-numeric arcIndex", async () => {
    const res = await get("/api/projects/proj-1/outline/arcs/abc");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

// ── Chapters ─────────────────────────────────────────────────────────────────

describe("GET /api/projects/:id/chapters", () => {
  it("returns chapter list", async () => {
    const chapters = [{ id: "ch1", chapterNumber: 1, title: "Prologue" }];
    mockChapterList.mockResolvedValue({ ok: true, data: chapters });

    const res = await get("/api/projects/proj-1/chapters");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(chapters);
  });
});

describe("GET /api/projects/:id/chapters/:num", () => {
  it("returns single chapter", async () => {
    const chapter = { id: "ch1", chapterNumber: 1, content: "Once upon a time..." };
    mockChapterRead.mockResolvedValue({ ok: true, data: chapter });

    const res = await get("/api/projects/proj-1/chapters/1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(chapter);
    expect(mockChapterRead).toHaveBeenCalledWith("proj-1", 1);
  });

  it("returns 404 when chapter not found", async () => {
    mockChapterRead.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "章节不存在" },
    });

    const res = await get("/api/projects/proj-1/chapters/999");
    expect(res.status).toBe(404);
  });

  it("returns 400 for non-numeric chapter number", async () => {
    const res = await get("/api/projects/proj-1/chapters/abc");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/projects/:id/chapters/:num/versions", () => {
  it("returns version history", async () => {
    const chapter = { id: "ch1", chapterNumber: 1 };
    const versions = [{ id: "v1", version: 1, content: "Draft 1" }];
    mockChapterRead.mockResolvedValue({ ok: true, data: chapter });
    mockChapterListVersions.mockResolvedValue({ ok: true, data: versions });

    const res = await get("/api/projects/proj-1/chapters/1/versions");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(versions);
    expect(mockChapterListVersions).toHaveBeenCalledWith("ch1");
  });

  it("returns 404 when chapter not found", async () => {
    mockChapterRead.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "章节不存在" },
    });

    const res = await get("/api/projects/proj-1/chapters/999/versions");
    expect(res.status).toBe(404);
  });
});

// ── Reviews ──────────────────────────────────────────────────────────────────

describe("GET /api/projects/:id/reviews", () => {
  it("returns review list on success", async () => {
    const reviews = [{ id: "r1", title: "Review Ch.1 Round 1" }];
    mockReviewList.mockResolvedValue({ ok: true, data: reviews });

    const res = await get("/api/projects/proj-1/reviews");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual(reviews);
    expect(mockReviewList).toHaveBeenCalledWith("proj-1");
  });

  it("returns 500 when service fails", async () => {
    mockReviewList.mockResolvedValue({
      ok: false,
      error: { code: "DB_ERROR", message: "db down" },
    });

    const res = await get("/api/projects/proj-1/reviews");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("DB_ERROR");
  });
});

describe("GET /api/projects/:id/reviews/:chapterNum", () => {
  it("returns rounds for chapter on success", async () => {
    const rounds = [
      { id: "r1", title: "Review Ch.1 Round 1" },
      { id: "r2", title: "Review Ch.1 Round 2" },
    ];
    mockReviewReadByChapter.mockResolvedValue({ ok: true, data: rounds });

    const res = await get("/api/projects/proj-1/reviews/1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual(rounds);
    expect(mockReviewReadByChapter).toHaveBeenCalledWith("proj-1", 1);
  });

  it("returns 500 when service fails", async () => {
    mockReviewReadByChapter.mockResolvedValue({
      ok: false,
      error: { code: "DB_ERROR", message: "error" },
    });

    const res = await get("/api/projects/proj-1/reviews/1");
    expect(res.status).toBe(500);
  });

  it("returns 400 for non-numeric chapterNum", async () => {
    const res = await get("/api/projects/proj-1/reviews/abc");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

// ── Analysis ─────────────────────────────────────────────────────────────────

describe("GET /api/projects/:id/analysis", () => {
  it("returns analysis list on success", async () => {
    const analyses = [{ id: "a1", title: "Analysis chapter 1-1" }];
    mockAnalysisList.mockResolvedValue({ ok: true, data: analyses });

    const res = await get("/api/projects/proj-1/analysis");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual(analyses);
    expect(mockAnalysisList).toHaveBeenCalledWith("proj-1", undefined);
  });

  it("passes ?scope= filter to service", async () => {
    mockAnalysisList.mockResolvedValue({ ok: true, data: [] });

    await get("/api/projects/proj-1/analysis?scope=chapter");
    expect(mockAnalysisList).toHaveBeenCalledWith("proj-1", { scope: "chapter" });
  });

  it("returns 500 when service fails", async () => {
    mockAnalysisList.mockResolvedValue({
      ok: false,
      error: { code: "DB_ERROR", message: "error" },
    });

    const res = await get("/api/projects/proj-1/analysis");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("DB_ERROR");
  });
});

describe("GET /api/projects/:id/analysis/trend", () => {
  it("returns trend data on success", async () => {
    const trend = [{ id: "t1", scope: "chapter", overall: 82, createdAt: new Date().toISOString() }];
    mockAnalysisTrend.mockResolvedValue({ ok: true, data: trend });

    const res = await get("/api/projects/proj-1/analysis/trend");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual(trend);
    expect(mockAnalysisTrend).toHaveBeenCalledWith("proj-1");
  });

  it("returns 500 when service fails", async () => {
    mockAnalysisTrend.mockResolvedValue({
      ok: false,
      error: { code: "DB_ERROR", message: "error" },
    });

    const res = await get("/api/projects/proj-1/analysis/trend");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/projects/:id/analysis/:chapterNum", () => {
  it("returns chapter-scoped analyses", async () => {
    const analyses = [{ id: "a1", title: "Analysis chapter 1-1" }];
    mockAnalysisList.mockResolvedValue({ ok: true, data: analyses });

    const res = await get("/api/projects/proj-1/analysis/1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual(analyses);
    expect(mockAnalysisList).toHaveBeenCalledWith("proj-1", { scope: "chapter" });
  });

  it("returns 400 for non-numeric chapterNum", async () => {
    const res = await get("/api/projects/proj-1/analysis/abc");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

// ── Knowledge ────────────────────────────────────────────────────────────────

describe("GET /api/projects/:id/knowledge", () => {
  it("returns paginated knowledge entries", async () => {
    const entries = [
      { id: "k1", title: "Magic System", content: "Rules of magic", category: "worldbuilding" },
      { id: "k2", title: "Character Note", content: "Alice backstory", category: "character" },
    ];
    mockKnowledgeList.mockResolvedValue({ ok: true, data: entries });

    const res = await get("/api/projects/proj-1/knowledge");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toMatchObject({ total: 2, page: 1, pageSize: 20, hasMore: false });
    expect(mockKnowledgeList).toHaveBeenCalledWith("project:proj-1");
  });

  it("filters by keyword in-memory", async () => {
    const entries = [
      { id: "k1", title: "Magic System", content: "Rules of magic" },
      { id: "k2", title: "Character Note", content: "Backstory" },
    ];
    mockKnowledgeList.mockResolvedValue({ ok: true, data: entries });

    const res = await get("/api/projects/proj-1/knowledge?keyword=magic");
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("k1");
  });

  it("returns 500 when service fails", async () => {
    mockKnowledgeList.mockResolvedValue({
      ok: false,
      error: { code: "DB_ERROR", message: "error" },
    });

    const res = await get("/api/projects/proj-1/knowledge");
    expect(res.status).toBe(500);
  });
});

// ── Stats ────────────────────────────────────────────────────────────────────

describe("GET /api/projects/:id/stats", () => {
  it("returns aggregate stats", async () => {
    const chapters = [
      { id: "ch1", chapterNumber: 1, wordCount: 3000 },
      { id: "ch2", chapterNumber: 2, wordCount: 2500 },
    ];
    const project = { id: "proj-1", status: "writing", title: "My Novel" };
    mockChapterList.mockResolvedValue({ ok: true, data: chapters });
    mockProjectRead.mockResolvedValue({ ok: true, data: project });

    const res = await get("/api/projects/proj-1/stats");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.totalChapters).toBe(2);
    expect(body.data.totalWords).toBe(5500);
    expect(body.data.project).toEqual(project);
  });

  it("returns 404 when project not found", async () => {
    mockChapterList.mockResolvedValue({ ok: true, data: [] });
    mockProjectRead.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "项目不存在" },
    });

    const res = await get("/api/projects/proj-1/stats");
    expect(res.status).toBe(404);
  });
});

// ── Agent Status (stub) ──────────────────────────────────────────────────────

describe("GET /api/projects/:id/agent-status", () => {
  it("returns empty agent status array", async () => {
    const res = await get("/api/projects/proj-1/agent-status");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual([]);
  });
});
