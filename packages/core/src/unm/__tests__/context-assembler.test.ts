import { describe, expect, it } from "vitest";

import { BudgetAllocator } from "../budget-allocator.js";
import { DEFAULT_BUDGET } from "../config.js";
import { ContextAssembler } from "../context-assembler.js";
import { createMockStore, makeSlice } from "./helpers.js";

function sectionByCategory(result: Awaited<ReturnType<ContextAssembler["assemble"]>>, category: string) {
  const section = result.sections.find((s) => s.category === category);
  if (!section) {
    throw new Error(`Missing section for ${category}`);
  }
  return section;
}

describe("ContextAssembler", () => {
  it("empty store returns empty sections and totalTokens=0", async () => {
    const assembler = new ContextAssembler(createMockStore());
    const result = await assembler.assemble({ projectId: "proj-1", chapterNumber: 10 });

    expect(result.totalTokens).toBe(0);
    expect(result.sections.length).toBe(6);
    expect(result.sections.every((s) => s.content === "" && s.tokenCount === 0 && s.sliceCount === 0)).toBe(true);
  });

  it("basic assembly populates sections with content", async () => {
    const store = createMockStore([
      makeSlice({ category: "guidance", tier: "hot", content: "G1", tokenCount: 2 }),
      makeSlice({ category: "world", stability: "canon", content: "W1", tokenCount: 2, relevanceTags: ["city"] }),
      makeSlice({ category: "characters", content: "C1", tokenCount: 2, relevanceTags: ["alice"] }),
      makeSlice({
        category: "consistency",
        content: "K1",
        tokenCount: 2,
        relevanceTags: ["status:planted"],
        sourceChapter: 9,
      }),
      makeSlice({ category: "summaries", content: "S1", tokenCount: 2, sourceChapter: 10 }),
      makeSlice({ category: "outline", tier: "hot", scope: "arc", content: "O1", tokenCount: 2 }),
    ]);
    const assembler = new ContextAssembler(store);

    const result = await assembler.assemble({
      projectId: "proj-1",
      chapterNumber: 12,
      sceneCharacters: ["alice"],
      sceneTags: ["city"],
    });

    expect(sectionByCategory(result, "guidance").content).toContain("G1");
    expect(sectionByCategory(result, "world").content).toContain("W1");
    expect(sectionByCategory(result, "characters").content).toContain("C1");
    expect(sectionByCategory(result, "consistency").content).toContain("K1");
    expect(sectionByCategory(result, "summaries").content).toContain("S1");
    expect(sectionByCategory(result, "outline").content).toContain("O1");
  });

  it("budget limit prevents selecting slices past allocation", async () => {
    const store = createMockStore([
      makeSlice({ category: "guidance", tier: "hot", content: "A", tokenCount: 4, priorityFloor: 100 }),
      makeSlice({ category: "guidance", tier: "warm", content: "B", tokenCount: 4, priorityFloor: 90 }),
    ]);
    const assembler = new ContextAssembler(store);

    const result = await assembler.assemble({
      projectId: "proj-1",
      chapterNumber: 1,
      customBudget: {
        guidance: 5,
        outline: 0,
        characters: 0,
        world: 0,
        summaries: 0,
        consistency: 0,
      },
    });

    const guidance = sectionByCategory(result, "guidance");
    expect(guidance.sliceCount).toBe(1);
    expect(guidance.tokenCount).toBeLessThanOrEqual(5);
  });

  it("priority ordering selects higher priorityFloor first", async () => {
    const store = createMockStore([
      makeSlice({ category: "guidance", tier: "hot", content: "low", tokenCount: 1, priorityFloor: 10, freshness: 1 }),
      makeSlice({ category: "guidance", tier: "warm", content: "high", tokenCount: 1, priorityFloor: 99, freshness: 1 }),
    ]);
    const assembler = new ContextAssembler(store);

    const result = await assembler.assemble({
      projectId: "proj-1",
      chapterNumber: 1,
      customBudget: {
        guidance: 10,
        outline: 0,
        characters: 0,
        world: 0,
        summaries: 0,
        consistency: 0,
      },
    });

    const lines = sectionByCategory(result, "guidance").content.split("\n");
    expect(lines[0]).toContain("high");
  });

  it("character boost increases character budget when sceneCharacters present", async () => {
    const assembler = new ContextAssembler(createMockStore());
    const result = await assembler.assemble({
      projectId: "proj-1",
      chapterNumber: 5,
      sceneCharacters: ["Alice"],
    });

    expect(result.budgetUsage.characters.allocated).toBe(DEFAULT_BUDGET.characters + 2000);
  });

  it("tag boost increases world budget when sceneTags present", async () => {
    const assembler = new ContextAssembler(createMockStore());
    const result = await assembler.assemble({
      projectId: "proj-1",
      chapterNumber: 5,
      sceneTags: ["city"],
    });

    expect(result.budgetUsage.world.allocated).toBe(DEFAULT_BUDGET.world + 1000);
  });

  it("guidance retrieval includes only hot and warm", async () => {
    const store = createMockStore([
      makeSlice({ category: "guidance", tier: "hot", content: "hot-guidance", tokenCount: 1 }),
      makeSlice({ category: "guidance", tier: "warm", content: "warm-guidance", tokenCount: 1 }),
      makeSlice({ category: "guidance", tier: "cold", content: "cold-guidance", tokenCount: 1 }),
    ]);
    const assembler = new ContextAssembler(store);

    const result = await assembler.assemble({
      projectId: "proj-1",
      chapterNumber: 1,
      customBudget: {
        guidance: 10,
        outline: 0,
        characters: 0,
        world: 0,
        summaries: 0,
        consistency: 0,
      },
    });
    const content = sectionByCategory(result, "guidance").content;

    expect(content).toContain("hot-guidance");
    expect(content).toContain("warm-guidance");
    expect(content).not.toContain("cold-guidance");
  });

  it("world retrieval prioritizes canon stability", async () => {
    const store = createMockStore([
      makeSlice({ category: "world", stability: "evolving", freshness: 0.9, content: "non-canon", tokenCount: 1, relevanceTags: ["city"] }),
      makeSlice({ category: "world", stability: "canon", freshness: 0.2, content: "canon", tokenCount: 1, relevanceTags: ["city"] }),
    ]);
    const assembler = new ContextAssembler(store);

    const result = await assembler.assemble({
      projectId: "proj-1",
      chapterNumber: 1,
      sceneTags: ["city"],
      customBudget: {
        world: 10,
        outline: 0,
        characters: 0,
        guidance: 0,
        summaries: 0,
        consistency: 0,
      },
    });

    const firstLine = sectionByCategory(result, "world").content.split("\n")[0];
    expect(firstLine).toContain("canon");
  });

  it("characters retrieval matches scene characters first, then network", async () => {
    const store = createMockStore([
      makeSlice({ category: "characters", content: "fallback", tokenCount: 1, relevanceTags: ["misc"] }),
      makeSlice({ category: "characters", content: "network", tokenCount: 1, relevanceTags: ["rel:bob"] }),
      makeSlice({ category: "characters", content: "exact", tokenCount: 1, relevanceTags: ["alice"] }),
    ]);
    const assembler = new ContextAssembler(store);

    const result = await assembler.assemble({
      projectId: "proj-1",
      chapterNumber: 1,
      sceneCharacters: ["Alice"],
      customBudget: {
        characters: 10,
        outline: 0,
        world: 0,
        guidance: 0,
        summaries: 0,
        consistency: 0,
      },
    });

    const lines = sectionByCategory(result, "characters").content.split("\n");
    expect(lines[0]).toContain("exact");
    expect(lines[1]).toContain("network");
    expect(lines[2]).toContain("fallback");
  });

  it("consistency retrieval orders planted/developing before resolved", async () => {
    const store = createMockStore([
      makeSlice({ category: "consistency", content: "resolved", tokenCount: 1, relevanceTags: ["status:resolved"], sourceChapter: 10 }),
      makeSlice({ category: "consistency", content: "developing", tokenCount: 1, relevanceTags: ["status:developing"], sourceChapter: 5 }),
      makeSlice({ category: "consistency", content: "planted", tokenCount: 1, relevanceTags: ["status:planted"], sourceChapter: 1 }),
    ]);
    const assembler = new ContextAssembler(store);

    const result = await assembler.assemble({
      projectId: "proj-1",
      chapterNumber: 12,
      customBudget: {
        consistency: 10,
        outline: 0,
        world: 0,
        guidance: 0,
        summaries: 0,
        characters: 0,
      },
    });

    const lines = sectionByCategory(result, "consistency").content.split("\n");
    expect(lines[0]).toContain("planted");
    expect(lines[1]).toContain("developing");
    expect(lines[2]).toContain("resolved");
  });

  it("summaries retrieval prioritizes recent chapters by window", async () => {
    const store = createMockStore([
      makeSlice({ category: "summaries", content: "global", tokenCount: 1, scope: "global", sourceChapter: 1 }),
      makeSlice({ category: "summaries", content: "arc", tokenCount: 1, scope: "arc", sourceChapter: 2 }),
      makeSlice({ category: "summaries", content: "recent", tokenCount: 1, scope: "chapter", sourceChapter: 11 }),
    ]);
    const assembler = new ContextAssembler(store, new BudgetAllocator());

    const result = await assembler.assemble({
      projectId: "proj-1",
      chapterNumber: 12,
      customBudget: {
        summaries: 10,
        outline: 0,
        world: 0,
        guidance: 0,
        consistency: 0,
        characters: 0,
      },
    });

    const lines = sectionByCategory(result, "summaries").content.split("\n");
    expect(lines[0]).toContain("recent");
    expect(lines[1]).toContain("arc");
    expect(lines[2]).toContain("global");
  });

  it("outline retrieval includes only hot arc slices", async () => {
    const store = createMockStore([
      makeSlice({ category: "outline", tier: "hot", scope: "arc", content: "hot-arc", tokenCount: 1 }),
      makeSlice({ category: "outline", tier: "warm", scope: "arc", content: "warm-arc", tokenCount: 1 }),
      makeSlice({ category: "outline", tier: "hot", scope: "chapter", content: "hot-chapter", tokenCount: 1 }),
    ]);
    const assembler = new ContextAssembler(store);

    const result = await assembler.assemble({
      projectId: "proj-1",
      chapterNumber: 10,
      customBudget: {
        outline: 10,
        world: 0,
        guidance: 0,
        consistency: 0,
        summaries: 0,
        characters: 0,
      },
    });
    const content = sectionByCategory(result, "outline").content;

    expect(content).toContain("hot-arc");
    expect(content).not.toContain("warm-arc");
    expect(content).not.toContain("hot-chapter");
  });
});
