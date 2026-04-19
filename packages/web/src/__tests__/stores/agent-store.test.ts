/**
 * Tests for Agent Store (T6)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAgentStore, type AgentStatus } from "@/stores/agent-store";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAgent(overrides: Partial<AgentStatus> = {}): AgentStatus {
  return {
    agentId: "zhibi",
    displayName: "执笔·剑心",
    state: "active",
    description: "写作第 38 章",
    startedAt: Date.now(),
    ...overrides,
  };
}

// Reset the store between tests by calling restoreFromAPI([])
function resetStore() {
  useAgentStore.setState({ agents: {} });
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  resetStore();
});

afterEach(() => {
  vi.useRealTimers();
  resetStore();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("useAgentStore", () => {
  describe("initial state", () => {
    it("starts with empty agents", () => {
      const { agents } = useAgentStore.getState();
      expect(agents).toEqual({});
    });
  });

  describe("addAgent()", () => {
    it("adds an agent to the store", () => {
      const agent = makeAgent();
      useAgentStore.getState().addAgent(agent);

      const { agents } = useAgentStore.getState();
      expect(agents["zhibi"]).toEqual(agent);
    });

    it("overwrites an existing agent with the same id", () => {
      const v1 = makeAgent({ description: "version 1" });
      const v2 = makeAgent({ description: "version 2" });

      useAgentStore.getState().addAgent(v1);
      useAgentStore.getState().addAgent(v2);

      expect(useAgentStore.getState().agents["zhibi"]?.description).toBe("version 2");
    });

    it("can hold multiple agents concurrently", () => {
      useAgentStore.getState().addAgent(makeAgent({ agentId: "a1" }));
      useAgentStore.getState().addAgent(makeAgent({ agentId: "a2" }));
      useAgentStore.getState().addAgent(makeAgent({ agentId: "a3" }));

      const { agents } = useAgentStore.getState();
      expect(Object.keys(agents)).toHaveLength(3);
    });
  });

  describe("updateAgent()", () => {
    it("updates specified fields", () => {
      useAgentStore.getState().addAgent(makeAgent());
      useAgentStore.getState().updateAgent("zhibi", { description: "updated" });

      expect(useAgentStore.getState().agents["zhibi"]?.description).toBe("updated");
    });

    it("preserves unmodified fields", () => {
      const agent = makeAgent({ displayName: "执笔·剑心", state: "active" });
      useAgentStore.getState().addAgent(agent);
      useAgentStore.getState().updateAgent("zhibi", { description: "new desc" });

      const updated = useAgentStore.getState().agents["zhibi"];
      expect(updated?.displayName).toBe("执笔·剑心");
      expect(updated?.state).toBe("active");
    });

    it("is a no-op for an unknown agentId", () => {
      useAgentStore.getState().addAgent(makeAgent({ agentId: "known" }));
      useAgentStore.getState().updateAgent("unknown-id", { description: "x" });

      // 'known' agent unchanged, 'unknown-id' not added
      const { agents } = useAgentStore.getState();
      expect(Object.keys(agents)).toHaveLength(1);
      expect(agents["known"]).toBeDefined();
    });
  });

  describe("removeAgent()", () => {
    it("removes the agent from the store", () => {
      useAgentStore.getState().addAgent(makeAgent());
      useAgentStore.getState().removeAgent("zhibi");
      expect(useAgentStore.getState().agents["zhibi"]).toBeUndefined();
    });

    it("is a no-op for an unknown agentId", () => {
      useAgentStore.getState().addAgent(makeAgent({ agentId: "keeper" }));
      useAgentStore.getState().removeAgent("ghost");
      expect(useAgentStore.getState().agents["keeper"]).toBeDefined();
    });
  });

  describe("restoreFromAPI()", () => {
    it("replaces all agents with the given snapshot", () => {
      useAgentStore.getState().addAgent(makeAgent({ agentId: "old" }));

      const snapshot: AgentStatus[] = [
        makeAgent({ agentId: "new1", state: "active" }),
        makeAgent({ agentId: "new2", state: "queued" }),
      ];
      useAgentStore.getState().restoreFromAPI(snapshot);

      const { agents } = useAgentStore.getState();
      expect(agents["old"]).toBeUndefined();
      expect(agents["new1"]).toBeDefined();
      expect(agents["new2"]).toBeDefined();
    });

    it("restores an empty list correctly", () => {
      useAgentStore.getState().addAgent(makeAgent());
      useAgentStore.getState().restoreFromAPI([]);
      expect(useAgentStore.getState().agents).toEqual({});
    });
  });

  describe("just_finished auto-remove (3s linger)", () => {
    it("removes agent 3s after state becomes just_finished via addAgent", () => {
      const agent = makeAgent({ state: "just_finished" });
      useAgentStore.getState().addAgent(agent);

      expect(useAgentStore.getState().agents["zhibi"]).toBeDefined();

      vi.advanceTimersByTime(2_999);
      expect(useAgentStore.getState().agents["zhibi"]).toBeDefined();

      vi.advanceTimersByTime(1);
      expect(useAgentStore.getState().agents["zhibi"]).toBeUndefined();
    });

    it("removes agent 3s after updateAgent sets just_finished", () => {
      useAgentStore.getState().addAgent(makeAgent({ state: "active" }));
      useAgentStore.getState().updateAgent("zhibi", { state: "just_finished" });

      vi.advanceTimersByTime(2_999);
      expect(useAgentStore.getState().agents["zhibi"]).toBeDefined();

      vi.advanceTimersByTime(1);
      expect(useAgentStore.getState().agents["zhibi"]).toBeUndefined();
    });

    it("does NOT auto-remove agents with other states", () => {
      useAgentStore.getState().addAgent(makeAgent({ state: "active" }));
      vi.advanceTimersByTime(10_000);
      expect(useAgentStore.getState().agents["zhibi"]).toBeDefined();
    });

    it("does not remove agent that changed state before 3s timer fires", () => {
      useAgentStore.getState().addAgent(makeAgent({ state: "active" }));
      useAgentStore.getState().updateAgent("zhibi", { state: "just_finished" });

      // Before the 3s timer fires, update to a non-just_finished state
      vi.advanceTimersByTime(1_000);
      useAgentStore.getState().updateAgent("zhibi", { state: "active" });

      vi.advanceTimersByTime(2_001); // timer fires, but state is no longer just_finished
      expect(useAgentStore.getState().agents["zhibi"]).toBeDefined();
    });

    it("schedules removal for just_finished agents in restoreFromAPI", () => {
      const snapshot: AgentStatus[] = [
        makeAgent({ agentId: "jf", state: "just_finished" }),
      ];
      useAgentStore.getState().restoreFromAPI(snapshot);

      vi.advanceTimersByTime(3_000);
      expect(useAgentStore.getState().agents["jf"]).toBeUndefined();
    });
  });
});
