/**
 * AgentStateTracker — Unit Tests
 */
import { describe, expect, it, beforeEach } from "vitest";
import { AgentStateTracker } from "../../sse/agent-state-tracker.js";

describe("AgentStateTracker", () => {
  let tracker: AgentStateTracker;

  beforeEach(() => {
    tracker = new AgentStateTracker();
  });

  it("starts with empty state for unknown project", () => {
    expect(tracker.getActiveAgents("proj-unknown")).toEqual([]);
  });

  it("tracks subtask start → returns agent in active list", () => {
    tracker.onSubtaskStart("proj-1", "墨衡", "协调写作流程");
    const agents = tracker.getActiveAgents("proj-1");
    expect(agents).toHaveLength(1);
    expect(agents[0].agentName).toBe("墨衡");
    expect(agents[0].status).toBe("running");
    expect(agents[0].taskDescription).toBe("协调写作流程");
    expect(typeof agents[0].startedAt).toBe("number");
  });

  it("tracks subtask end → removes agent from active list", () => {
    tracker.onSubtaskStart("proj-1", "墨衡", "协调写作流程");
    tracker.onSubtaskEnd("proj-1", "墨衡");
    expect(tracker.getActiveAgents("proj-1")).toEqual([]);
  });

  it("handles multiple agents simultaneously", () => {
    tracker.onSubtaskStart("proj-1", "墨衡", "协调");
    tracker.onSubtaskStart("proj-1", "执笔", "写作第三章");
    tracker.onSubtaskStart("proj-1", "明镜", "审校");

    const agents = tracker.getActiveAgents("proj-1");
    expect(agents).toHaveLength(3);
    const names = agents.map((a) => a.agentName);
    expect(names).toContain("墨衡");
    expect(names).toContain("执笔");
    expect(names).toContain("明镜");
  });

  it("removing one agent leaves others intact", () => {
    tracker.onSubtaskStart("proj-1", "墨衡", "协调");
    tracker.onSubtaskStart("proj-1", "执笔", "写作");
    tracker.onSubtaskEnd("proj-1", "墨衡");

    const agents = tracker.getActiveAgents("proj-1");
    expect(agents).toHaveLength(1);
    expect(agents[0].agentName).toBe("执笔");
  });

  it("clearProject removes all tracked agents", () => {
    tracker.onSubtaskStart("proj-1", "墨衡", "协调");
    tracker.onSubtaskStart("proj-1", "执笔", "写作");
    tracker.clearProject("proj-1");
    expect(tracker.getActiveAgents("proj-1")).toEqual([]);
  });

  it("isolates state between different projects", () => {
    tracker.onSubtaskStart("proj-1", "墨衡", "协调");
    tracker.onSubtaskStart("proj-2", "执笔", "写作");

    expect(tracker.getActiveAgents("proj-1")).toHaveLength(1);
    expect(tracker.getActiveAgents("proj-2")).toHaveLength(1);

    tracker.clearProject("proj-1");
    expect(tracker.getActiveAgents("proj-1")).toEqual([]);
    expect(tracker.getActiveAgents("proj-2")).toHaveLength(1);
  });

  it("onSubtaskEnd on unknown project is a no-op", () => {
    expect(() => tracker.onSubtaskEnd("proj-unknown", "墨衡")).not.toThrow();
  });

  it("onSubtaskStart without taskDescription sets it as undefined", () => {
    tracker.onSubtaskStart("proj-1", "墨衡");
    const agents = tracker.getActiveAgents("proj-1");
    expect(agents[0].taskDescription).toBeUndefined();
  });
});
