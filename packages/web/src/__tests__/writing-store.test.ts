import { describe, it, expect, beforeEach } from "vitest";
import { useWritingStore } from "@/stores/writing-store";

/**
 * Writing store unit tests.
 * Tests Zustand store actions and state transitions.
 */
describe("writing-store", () => {
  beforeEach(() => {
    // Reset store to initial state
    useWritingStore.getState().reset();
  });

  it("starts with idle stage", () => {
    const state = useWritingStore.getState();
    expect(state.stage).toBe("idle");
    expect(state.content).toBe("");
    expect(state.wordCount).toBe(0);
    expect(state.chapterNumber).toBeNull();
    expect(state.reviewResult).toBeNull();
    expect(state.budget).toBeNull();
    expect(state.error).toBeNull();
  });

  it("appendContent accumulates text", () => {
    const store = useWritingStore.getState();
    store.appendContent("第一段");
    store.appendContent("第二段");
    expect(useWritingStore.getState().content).toBe("第一段第二段");
  });

  it("setStage transitions correctly", () => {
    const store = useWritingStore.getState();
    store.setStage("context");
    expect(useWritingStore.getState().stage).toBe("context");
    store.setStage("writing");
    expect(useWritingStore.getState().stage).toBe("writing");
    store.setStage("reviewing");
    expect(useWritingStore.getState().stage).toBe("reviewing");
    store.setStage("done");
    expect(useWritingStore.getState().stage).toBe("done");
  });

  it("setError transitions to error stage", () => {
    const store = useWritingStore.getState();
    store.setStage("writing");
    store.setError("连接中断");
    const state = useWritingStore.getState();
    expect(state.error).toBe("连接中断");
    expect(state.stage).toBe("error");
  });

  it("setError(null) goes back to idle", () => {
    const store = useWritingStore.getState();
    store.setError("some error");
    store.setError(null);
    const state = useWritingStore.getState();
    expect(state.error).toBeNull();
    expect(state.stage).toBe("idle");
  });

  it("setBudget stores token budget", () => {
    const store = useWritingStore.getState();
    const budget = { total: 50000, used: 12000, remaining: 38000 };
    store.setBudget(budget);
    expect(useWritingStore.getState().budget).toEqual(budget);
  });

  it("setReviewResult stores review data", () => {
    const store = useWritingStore.getState();
    const result = {
      round: 1,
      passed: false,
      score: 72,
      issues: [
        { severity: "MAJOR" as const, message: "角色性格不一致" },
      ],
    };
    store.setReviewResult(result);
    expect(useWritingStore.getState().reviewResult).toEqual(result);
  });

  it("setWordCount updates count", () => {
    const store = useWritingStore.getState();
    store.setWordCount(3500);
    expect(useWritingStore.getState().wordCount).toBe(3500);
  });

  it("setChapterNumber updates chapter", () => {
    const store = useWritingStore.getState();
    store.setChapterNumber(7);
    expect(useWritingStore.getState().chapterNumber).toBe(7);
  });

  it("reset clears everything", () => {
    const store = useWritingStore.getState();
    store.setStage("writing");
    store.appendContent("some content");
    store.setWordCount(1000);
    store.setChapterNumber(5);
    store.setBudget({ total: 50000, used: 10000, remaining: 40000 });
    store.setError("err");

    store.reset();

    const state = useWritingStore.getState();
    expect(state.stage).toBe("idle");
    expect(state.content).toBe("");
    expect(state.wordCount).toBe(0);
    expect(state.chapterNumber).toBeNull();
    expect(state.budget).toBeNull();
    expect(state.error).toBeNull();
  });
});
