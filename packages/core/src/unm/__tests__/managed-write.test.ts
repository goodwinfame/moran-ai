import { beforeEach, describe, expect, it } from "vitest";

import { CHARS_PER_TOKEN, DEFAULT_CAPS } from "../config.js";
import { ManagedWrite } from "../managed-write.js";
import type { WriteRequest } from "../types.js";
import { createMockStore, makeSlice, VALID_PROJECT_ID } from "./helpers.js";

function unsafeWriteRequest(input: Record<string, unknown>): WriteRequest {
  return input as unknown as WriteRequest;
}

describe("ManagedWrite", () => {
  let writer: ManagedWrite;

  beforeEach(() => {
    writer = new ManagedWrite(createMockStore());
  });

  it("valid write: inserts and returns slice", async () => {
    const result = await writer.write({
      projectId: VALID_PROJECT_ID,
      category: "guidance",
      content: "Use sparse foreshadowing.",
      scope: "arc",
      stability: "ephemeral",
      tier: "hot",
      priorityFloor: 75,
      relevanceTags: ["tone", "foreshadowing"],
      sourceChapter: 3,
      sourceAgent: "planner",
    });

    expect(result.success).toBe(true);
    expect(result.slice).toBeDefined();
    expect(result.slice?.projectId).toBe(VALID_PROJECT_ID);
    expect(result.slice?.tier).toBe("hot");
    expect(result.slice?.priorityFloor).toBe(75);
  });

  it("default classification applies scope, stability, tier, and priority defaults", async () => {
    const world = await writer.write({
      projectId: VALID_PROJECT_ID,
      category: "world",
      content: "The capital city sits on basalt cliffs.",
    });
    const guidance = await writer.write({
      projectId: VALID_PROJECT_ID,
      category: "guidance",
      content: "Keep prose tight in combat beats.",
    });

    expect(world.success).toBe(true);
    expect(world.slice?.scope).toBe("chapter");
    expect(world.slice?.stability).toBe("canon");
    expect(world.slice?.tier).toBe("warm");
    expect(world.slice?.priorityFloor).toBe(50);

    expect(guidance.success).toBe(true);
    expect(guidance.slice?.stability).toBe("ephemeral");
  });

  it("validation failure: missing projectId", async () => {
    const result = await writer.write(
      unsafeWriteRequest({
        category: "guidance",
        content: "Missing project id should fail.",
      }),
    );

    expect(result.success).toBe(false);
    expect(result.warnings?.some((w) => w.includes("projectId"))).toBe(true);
  });

  it("validation failure: invalid category", async () => {
    const result = await writer.write(
      unsafeWriteRequest({
        projectId: VALID_PROJECT_ID,
        category: "invalid-category",
        content: "Bad category",
      }),
    );

    expect(result.success).toBe(false);
    expect(result.warnings?.some((w) => w.includes("category"))).toBe(true);
  });

  it("validation failure: empty content", async () => {
    const result = await writer.write({
      projectId: VALID_PROJECT_ID,
      category: "guidance",
      content: "",
    });

    expect(result.success).toBe(false);
    expect(result.warnings?.some((w) => w.includes("content"))).toBe(true);
  });

  it("token counting computes charCount and tokenCount", async () => {
    const content = "123456789012345";
    const result = await writer.write({
      projectId: VALID_PROJECT_ID,
      category: "guidance",
      content,
    });

    expect(result.success).toBe(true);
    expect(result.slice?.charCount).toBe(content.length);
    expect(result.slice?.tokenCount).toBe(Math.max(1, Math.ceil(content.length / CHARS_PER_TOKEN)));
  });

  it("freshness starts at 1.0", async () => {
    const result = await writer.write({
      projectId: VALID_PROJECT_ID,
      category: "guidance",
      content: "Freshly written memory",
    });

    expect(result.success).toBe(true);
    expect(result.slice?.freshness).toBe(1);
  });

  it("backpressure trigger evicts stalest slice by freshness", async () => {
    const caps = {
      ...DEFAULT_CAPS,
      guidance: { ...DEFAULT_CAPS.guidance, cold: 10 },
    };
    const store = createMockStore([
      makeSlice({
        id: "cold-stale",
        projectId: VALID_PROJECT_ID,
        category: "guidance",
        tier: "cold",
        tokenCount: 6,
        freshness: 0.1,
      }),
      makeSlice({
        id: "cold-fresh",
        projectId: VALID_PROJECT_ID,
        category: "guidance",
        tier: "cold",
        tokenCount: 5,
        freshness: 0.9,
      }),
    ]);
    const customWriter = new ManagedWrite(store, caps);

    const result = await customWriter.write({
      projectId: VALID_PROJECT_ID,
      category: "guidance",
      tier: "cold",
      content: "z",
    });

    expect(result.success).toBe(true);
    expect(result.warnings).toEqual(["Backpressure triggered for guidance/cold"]);
    expect(result.evicted?.map((s) => s.id)).toContain("cold-stale");
  });

  it("backpressure hot->warm downgrades stalest hot slice", async () => {
    const caps = {
      ...DEFAULT_CAPS,
      guidance: { ...DEFAULT_CAPS.guidance, hot: 10 },
    };
    const store = createMockStore([
      makeSlice({
        id: "hot-stale",
        projectId: VALID_PROJECT_ID,
        category: "guidance",
        tier: "hot",
        tokenCount: 8,
        freshness: 0.05,
      }),
      makeSlice({
        id: "hot-fresh",
        projectId: VALID_PROJECT_ID,
        category: "guidance",
        tier: "hot",
        tokenCount: 2,
        freshness: 0.95,
      }),
    ]);
    const customWriter = new ManagedWrite(store, caps);

    const result = await customWriter.write({
      projectId: VALID_PROJECT_ID,
      category: "guidance",
      tier: "hot",
      content: "123456",
    });

    expect(result.success).toBe(true);
    expect(result.evicted?.[0]?.id).toBe("hot-stale");
    expect(result.evicted?.[0]?.tier).toBe("warm");
  });

  it("backpressure warm->cold downgrades stalest warm slice", async () => {
    const caps = {
      ...DEFAULT_CAPS,
      guidance: { ...DEFAULT_CAPS.guidance, warm: 10 },
    };
    const store = createMockStore([
      makeSlice({
        id: "warm-stale",
        projectId: VALID_PROJECT_ID,
        category: "guidance",
        tier: "warm",
        tokenCount: 8,
        freshness: 0.05,
      }),
      makeSlice({
        id: "warm-fresh",
        projectId: VALID_PROJECT_ID,
        category: "guidance",
        tier: "warm",
        tokenCount: 2,
        freshness: 0.95,
      }),
    ]);
    const customWriter = new ManagedWrite(store, caps);

    const result = await customWriter.write({
      projectId: VALID_PROJECT_ID,
      category: "guidance",
      tier: "warm",
      content: "123456",
    });

    expect(result.success).toBe(true);
    expect(result.evicted?.[0]?.id).toBe("warm-stale");
    expect(result.evicted?.[0]?.tier).toBe("cold");
  });

  it("no backpressure for Infinity cap (cold tier defaults)", async () => {
    const store = createMockStore([
      makeSlice({
        projectId: VALID_PROJECT_ID,
        category: "guidance",
        tier: "cold",
        tokenCount: 999999,
      }),
    ]);
    const defaultWriter = new ManagedWrite(store);

    const result = await defaultWriter.write({
      projectId: VALID_PROJECT_ID,
      category: "guidance",
      tier: "cold",
      content: "Still accepted",
    });

    expect(result.success).toBe(true);
    expect(result.evicted).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("custom caps are used by constructor", async () => {
    const customCaps = {
      ...DEFAULT_CAPS,
      guidance: { ...DEFAULT_CAPS.guidance, warm: 5 },
    };
    const store = createMockStore();
    const customWriter = new ManagedWrite(store, customCaps);

    const result = await customWriter.write({
      projectId: VALID_PROJECT_ID,
      category: "guidance",
      tier: "warm",
      content: "123456789",
    });

    expect(result.success).toBe(true);
    expect(result.evicted?.length).toBe(1);
    expect(result.evicted?.[0]?.tier).toBe("cold");
  });
});
