import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock setup ──────────────────────────────────────────────────────────────
// These mocks must be declared before imports that use them.

const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

vi.mock("@moran/core/db", () => ({
  getDb: () => ({ select: mockSelect }),
}));

// Mock schema tables — checker only uses them as column references passed to drizzle operators.
// We provide plain objects so eq/and can receive them without crashing.
vi.mock("@moran/core/db/schema", () => ({
  projectDocuments: { id: "pd.id", projectId: "pd.projectId", category: "pd.category" },
  worldSettings: { id: "ws.id", projectId: "ws.projectId", section: "ws.section" },
  characters: { id: "ch.id", projectId: "ch.projectId" },
  characterRelationships: { id: "cr.id", projectId: "cr.projectId" },
  outlines: { id: "ol.id", projectId: "ol.projectId" },
  styleConfigs: { id: "sc.id", projectId: "sc.projectId" },
  chapterBriefs: { id: "cb.id", projectId: "cb.projectId", chapterNumber: "cb.chapterNumber" },
  chapters: { id: "cp.id", projectId: "cp.projectId", chapterNumber: "cp.chapterNumber" },
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────
import { checkPrerequisites, toGateDetails } from "../../gates/checker.js";
import type { GateResult, GateCondition } from "../../gates/checker.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Queue a where() call that returns { limit: fn } — for queries with .limit(1). */
function mockRow(hasRow: boolean): void {
  const result = hasRow ? [{ id: "fake-id" }] : [];
  mockSelectWhere.mockReturnValueOnce({
    limit: vi.fn().mockResolvedValueOnce(result),
  });
}

/** Queue a where() call that resolves directly (no .limit) — for countMainCharacters. */
function mockRows(count: number): void {
  const rows = Array.from({ length: count }, (_, i) => ({ id: `id-${i}` }));
  mockSelectWhere.mockReturnValueOnce(Promise.resolve(rows));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSelectFrom.mockImplementation(() => ({ where: mockSelectWhere }));
  mockSelect.mockImplementation(() => ({ from: mockSelectFrom }));
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("checkPrerequisites()", () => {
  describe("brainstorm action", () => {
    it("passes with no conditions (no DB calls)", async () => {
      const result = await checkPrerequisites("proj-1", "brainstorm");
      expect(result.passed).toBe(true);
      expect(result.conditions).toHaveLength(0);
      expect(mockSelect).not.toHaveBeenCalled();
    });
  });

  describe("world_design action", () => {
    it("passes when brainstorm brief exists", async () => {
      mockRow(true); // hasBrainstormBrief
      const result = await checkPrerequisites("proj-1", "world_design");
      expect(result.passed).toBe(true);
      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]!.met).toBe(true);
      expect(result.conditions[0]!.level).toBe("HARD");
    });

    it("fails when brainstorm brief is missing", async () => {
      mockRow(false); // hasBrainstormBrief
      const result = await checkPrerequisites("proj-1", "world_design");
      expect(result.passed).toBe(false);
      expect(result.conditions[0]!.met).toBe(false);
      expect(result.conditions[0]!.suggestion).toBeTruthy();
    });

    it("condition has no suggestion when met", async () => {
      mockRow(true);
      const result = await checkPrerequisites("proj-1", "world_design");
      expect(result.conditions[0]!.suggestion).toBeUndefined();
    });
  });

  describe("character_design action", () => {
    it("passes when all HARD conditions met (SOFT may fail)", async () => {
      mockRow(true); // hasBrainstormBrief
      mockRow(true); // hasBaseWorldSetting
      mockRow(false); // hasSubsystem (SOFT — should not fail gate)
      const result = await checkPrerequisites("proj-1", "character_design");
      expect(result.passed).toBe(true);
      expect(result.conditions).toHaveLength(3);
    });

    it("fails when brainstorm brief missing", async () => {
      mockRow(false); // hasBrainstormBrief
      mockRow(true); // hasBaseWorldSetting
      mockRow(true); // hasSubsystem
      const result = await checkPrerequisites("proj-1", "character_design");
      expect(result.passed).toBe(false);
    });

    it("fails when base world setting missing", async () => {
      mockRow(true); // hasBrainstormBrief
      mockRow(false); // hasBaseWorldSetting
      mockRow(true); // hasSubsystem
      const result = await checkPrerequisites("proj-1", "character_design");
      expect(result.passed).toBe(false);
    });

    it("SOFT subsystem condition does not cause failure", async () => {
      mockRow(true); // hasBrainstormBrief
      mockRow(true); // hasBaseWorldSetting
      mockRow(false); // hasSubsystem — SOFT
      const result = await checkPrerequisites("proj-1", "character_design");
      expect(result.passed).toBe(true);
      const softCond = result.conditions.find((c) => c.level === "SOFT");
      expect(softCond).toBeDefined();
      expect(softCond?.met).toBe(false);
    });

    it("SOFT subsystem condition has suggestion when not met", async () => {
      mockRow(true);
      mockRow(true);
      mockRow(false);
      const result = await checkPrerequisites("proj-1", "character_design");
      const softCond = result.conditions.find((c) => c.level === "SOFT");
      expect(softCond?.suggestion).toBeTruthy();
    });

    it("SOFT subsystem condition has no suggestion when met", async () => {
      mockRow(true);
      mockRow(true);
      mockRow(true);
      const result = await checkPrerequisites("proj-1", "character_design");
      const softCond = result.conditions.find((c) => c.level === "SOFT");
      expect(softCond?.suggestion).toBeUndefined();
    });
  });

  describe("outline_design action", () => {
    it("passes when all conditions met (charCount >= 2, relationship exists)", async () => {
      mockRow(true); // hasBrainstormBrief
      mockRow(true); // hasBaseWorldSetting
      mockRows(3); // countMainCharacters — returns 3 rows
      mockRow(true); // hasRelationship
      const result = await checkPrerequisites("proj-1", "outline_design");
      expect(result.passed).toBe(true);
      expect(result.conditions).toHaveLength(4);
    });

    it("fails when brainstorm brief missing", async () => {
      mockRow(false);
      mockRow(true);
      mockRows(2);
      mockRow(true);
      const result = await checkPrerequisites("proj-1", "outline_design");
      expect(result.passed).toBe(false);
    });

    it("fails when base world setting missing", async () => {
      mockRow(true);
      mockRow(false);
      mockRows(2);
      mockRow(true);
      const result = await checkPrerequisites("proj-1", "outline_design");
      expect(result.passed).toBe(false);
    });

    it("fails when fewer than 2 characters", async () => {
      mockRow(true);
      mockRow(true);
      mockRows(1); // only 1 character
      mockRow(true);
      const result = await checkPrerequisites("proj-1", "outline_design");
      expect(result.passed).toBe(false);
      const charCond = result.conditions.find((c) => c.description.includes("角色"));
      expect(charCond?.met).toBe(false);
    });

    it("passes when exactly 2 characters", async () => {
      mockRow(true);
      mockRow(true);
      mockRows(2);
      mockRow(true);
      const result = await checkPrerequisites("proj-1", "outline_design");
      const charCond = result.conditions.find((c) => c.description.includes("角色"));
      expect(charCond?.met).toBe(true);
    });

    it("fails when no relationship exists", async () => {
      mockRow(true);
      mockRow(true);
      mockRows(2);
      mockRow(false); // hasRelationship
      const result = await checkPrerequisites("proj-1", "outline_design");
      expect(result.passed).toBe(false);
    });

    it("character count condition suggestion includes current count when < 2", async () => {
      mockRow(true);
      mockRow(true);
      mockRows(0);
      mockRow(true);
      const result = await checkPrerequisites("proj-1", "outline_design");
      const charCond = result.conditions.find((c) => c.description.includes("角色"));
      expect(charCond?.suggestion).toContain("0");
    });
  });

  describe("style_design action", () => {
    it("passes when brainstorm brief exists", async () => {
      mockRow(true);
      const result = await checkPrerequisites("proj-1", "style_design");
      expect(result.passed).toBe(true);
      expect(result.conditions).toHaveLength(1);
    });

    it("fails when brainstorm brief missing", async () => {
      mockRow(false);
      const result = await checkPrerequisites("proj-1", "style_design");
      expect(result.passed).toBe(false);
    });
  });

  describe("chapter_write action", () => {
    it("passes when outline, chapter brief, and style all exist", async () => {
      mockRow(true); // hasOutline
      mockRow(true); // hasChapterBrief
      mockRow(true); // hasStyle
      const result = await checkPrerequisites("proj-1", "chapter_write", { chapterNumber: 1 });
      expect(result.passed).toBe(true);
      expect(result.conditions).toHaveLength(3);
    });

    it("fails when outline missing", async () => {
      mockRow(false);
      mockRow(true);
      mockRow(true);
      const result = await checkPrerequisites("proj-1", "chapter_write", { chapterNumber: 1 });
      expect(result.passed).toBe(false);
    });

    it("fails when chapter brief missing", async () => {
      mockRow(true);
      mockRow(false);
      mockRow(true);
      const result = await checkPrerequisites("proj-1", "chapter_write", { chapterNumber: 1 });
      expect(result.passed).toBe(false);
    });

    it("fails when style missing", async () => {
      mockRow(true);
      mockRow(true);
      mockRow(false);
      const result = await checkPrerequisites("proj-1", "chapter_write", { chapterNumber: 1 });
      expect(result.passed).toBe(false);
    });

    it("defaults chapterNumber to 1 when params not provided", async () => {
      mockRow(true);
      mockRow(true);
      mockRow(true);
      const result = await checkPrerequisites("proj-1", "chapter_write");
      expect(result.passed).toBe(true);
      const briefCond = result.conditions.find((c) => c.description.includes("章"));
      expect(briefCond?.description).toContain("1");
    });

    it("uses provided chapterNumber in condition description", async () => {
      mockRow(true);
      mockRow(true);
      mockRow(true);
      const result = await checkPrerequisites("proj-1", "chapter_write", { chapterNumber: 5 });
      const briefCond = result.conditions.find((c) => c.description.includes("Brief"));
      expect(briefCond?.description).toContain("5");
    });
  });

  describe("review action", () => {
    it("passes when chapter exists", async () => {
      mockRow(true);
      const result = await checkPrerequisites("proj-1", "review", { chapterNumber: 2 });
      expect(result.passed).toBe(true);
      expect(result.conditions).toHaveLength(1);
    });

    it("fails when chapter does not exist", async () => {
      mockRow(false);
      const result = await checkPrerequisites("proj-1", "review", { chapterNumber: 2 });
      expect(result.passed).toBe(false);
      expect(result.conditions[0]!.met).toBe(false);
    });

    it("defaults chapterNumber to 1 when params not provided", async () => {
      mockRow(true);
      const result = await checkPrerequisites("proj-1", "review");
      expect(result.passed).toBe(true);
      expect(result.conditions[0]!.description).toContain("1");
    });

    it("uses provided chapterNumber in condition description", async () => {
      mockRow(true);
      const result = await checkPrerequisites("proj-1", "review", { chapterNumber: 3 });
      expect(result.conditions[0]!.description).toContain("3");
    });
  });

  describe("archive action", () => {
    it("passes when chapter exists", async () => {
      mockRow(true);
      const result = await checkPrerequisites("proj-1", "archive", { chapterNumber: 1 });
      expect(result.passed).toBe(true);
      expect(result.conditions).toHaveLength(1);
    });

    it("fails when chapter does not exist", async () => {
      mockRow(false);
      const result = await checkPrerequisites("proj-1", "archive", { chapterNumber: 1 });
      expect(result.passed).toBe(false);
    });

    it("defaults chapterNumber to 1 when params not provided", async () => {
      mockRow(true);
      const result = await checkPrerequisites("proj-1", "archive");
      expect(result.passed).toBe(true);
      expect(result.conditions[0]!.description).toContain("1");
    });
  });

  describe("analysis action", () => {
    it("passes when any world setting exists", async () => {
      mockRow(true);
      const result = await checkPrerequisites("proj-1", "analysis");
      expect(result.passed).toBe(true);
      expect(result.conditions).toHaveLength(1);
    });

    it("fails when no world setting exists", async () => {
      mockRow(false);
      const result = await checkPrerequisites("proj-1", "analysis");
      expect(result.passed).toBe(false);
      expect(result.conditions[0]!.met).toBe(false);
    });
  });

  describe("unknown action", () => {
    it("passes through with no conditions and no DB calls", async () => {
      const result = await checkPrerequisites("proj-1", "unknown_action_xyz");
      expect(result.passed).toBe(true);
      expect(result.conditions).toHaveLength(0);
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("passes through for empty string action", async () => {
      const result = await checkPrerequisites("proj-1", "");
      expect(result.passed).toBe(true);
      expect(result.conditions).toHaveLength(0);
    });
  });
});

describe("toGateDetails()", () => {
  it("separates met and unmet conditions into passed/failed arrays", () => {
    const gateResult: GateResult = {
      passed: true,
      conditions: [
        { description: "Condition A", level: "HARD", met: true },
        { description: "Condition B", level: "HARD", met: false, suggestion: "Do B" },
        { description: "Condition C", level: "SOFT", met: true },
      ],
    };
    const details = toGateDetails(gateResult);
    expect(details.passed).toEqual(["Condition A", "Condition C"]);
    expect(details.failed).toEqual(["Condition B"]);
  });

  it("collects suggestions only from unmet conditions that have one", () => {
    const gateResult: GateResult = {
      passed: false,
      conditions: [
        { description: "A", level: "HARD", met: false, suggestion: "Fix A" },
        { description: "B", level: "HARD", met: false }, // no suggestion
        { description: "C", level: "SOFT", met: false, suggestion: "Fix C" },
      ],
    };
    const details = toGateDetails(gateResult);
    expect(details.suggestions).toEqual(["Fix A", "Fix C"]);
  });

  it("returns empty arrays when all conditions are met", () => {
    const gateResult: GateResult = {
      passed: true,
      conditions: [
        { description: "A", level: "HARD", met: true },
        { description: "B", level: "SOFT", met: true },
      ],
    };
    const details = toGateDetails(gateResult);
    expect(details.passed).toEqual(["A", "B"]);
    expect(details.failed).toEqual([]);
    expect(details.suggestions).toEqual([]);
  });

  it("returns empty arrays when conditions array is empty", () => {
    const gateResult: GateResult = { passed: true, conditions: [] };
    const details = toGateDetails(gateResult);
    expect(details.passed).toEqual([]);
    expect(details.failed).toEqual([]);
    expect(details.suggestions).toEqual([]);
  });

  it("does not include suggestions from met conditions", () => {
    const gateResult: GateResult = {
      passed: true,
      conditions: [
        { description: "A", level: "HARD", met: true, suggestion: "Should not appear" },
      ],
    };
    const details = toGateDetails(gateResult);
    expect(details.suggestions).toEqual([]);
  });

  it("returns GateDetails shape with passed, failed, suggestions", () => {
    const gateResult: GateResult = { passed: true, conditions: [] };
    const details = toGateDetails(gateResult);
    expect(details).toHaveProperty("passed");
    expect(details).toHaveProperty("failed");
    expect(details).toHaveProperty("suggestions");
  });

  it("handles all conditions unmet with suggestions", () => {
    const conditions: GateCondition[] = [
      { description: "X", level: "HARD", met: false, suggestion: "Do X" },
      { description: "Y", level: "HARD", met: false, suggestion: "Do Y" },
    ];
    const details = toGateDetails({ passed: false, conditions });
    expect(details.passed).toEqual([]);
    expect(details.failed).toEqual(["X", "Y"]);
    expect(details.suggestions).toEqual(["Do X", "Do Y"]);
  });
});
