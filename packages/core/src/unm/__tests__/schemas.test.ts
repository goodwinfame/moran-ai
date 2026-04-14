import { describe, expect, it } from "vitest";

import { writeRequestSchema } from "../schemas.js";

describe("writeRequestSchema", () => {
  it("valid input with all fields passes", () => {
    const result = writeRequestSchema.safeParse({
      projectId: "11111111-1111-4111-8111-111111111111",
      category: "guidance",
      content: "Use active voice in action scenes.",
      scope: "chapter",
      stability: "ephemeral",
      tier: "warm",
      priorityFloor: 60,
      relevanceTags: ["style", "action"],
      sourceChapter: 4,
      sourceAgent: "reviewer",
    });

    expect(result.success).toBe(true);
  });

  it("minimal input with required fields passes", () => {
    const result = writeRequestSchema.safeParse({
      projectId: "11111111-1111-4111-8111-111111111111",
      category: "world",
      content: "The northern pass is frozen year-round.",
    });

    expect(result.success).toBe(true);
  });

  it("invalid UUID fails", () => {
    const result = writeRequestSchema.safeParse({
      projectId: "proj-1",
      category: "guidance",
      content: "x",
    });

    expect(result.success).toBe(false);
  });

  it("invalid category fails", () => {
    const result = writeRequestSchema.safeParse({
      projectId: "11111111-1111-4111-8111-111111111111",
      category: "invalid",
      content: "x",
    });

    expect(result.success).toBe(false);
  });

  it("priorityFloor out of range fails", () => {
    const result = writeRequestSchema.safeParse({
      projectId: "11111111-1111-4111-8111-111111111111",
      category: "guidance",
      content: "x",
      priorityFloor: 101,
    });

    expect(result.success).toBe(false);
  });

  it("empty content fails", () => {
    const result = writeRequestSchema.safeParse({
      projectId: "11111111-1111-4111-8111-111111111111",
      category: "guidance",
      content: "",
    });

    expect(result.success).toBe(false);
  });

  it("missing optional fields still passes", () => {
    const result = writeRequestSchema.safeParse({
      projectId: "11111111-1111-4111-8111-111111111111",
      category: "summaries",
      content: "Chapter recap.",
    });

    expect(result.success).toBe(true);
  });
});
