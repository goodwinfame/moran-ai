/**
 * Agent Store — Zustand store tracking sub-agent status.
 * T6: packages/web/src/stores/agent-store.ts
 *
 * State is stored as Record<string, AgentStatus> (plain object), not Map,
 * so Zustand can detect mutations and trigger re-renders.
 */

import { create } from "zustand";

export interface AgentStatus {
  agentId: string;
  displayName: string;
  state: "active" | "queued" | "background" | "just_finished";
  description: string;
  startedAt: number;
  targetTab?: string;
}

interface AgentState {
  agents: Record<string, AgentStatus>;

  /** Add a new agent entry (e.g. on subtask_start) */
  addAgent: (data: AgentStatus) => void;

  /** Partially update an existing agent (e.g. on subtask_progress) */
  updateAgent: (agentId: string, update: Partial<AgentStatus>) => void;

  /** Remove an agent immediately */
  removeAgent: (agentId: string) => void;

  /** Replace all agent state from a REST snapshot (reconnect recovery) */
  restoreFromAPI: (statuses: AgentStatus[]) => void;
}

const JUST_FINISHED_LINGER_MS = 3_000;

/** Schedule automatic removal of an agent once it reaches just_finished */
function scheduleRemoval(
  agentId: string,
  set: (fn: (state: AgentState) => Partial<AgentState>) => void,
): void {
  setTimeout(() => {
    set((state) => {
      const agent = state.agents[agentId];
      if (!agent || agent.state !== "just_finished") return {};
      const updated = { ...state.agents };
      delete updated[agentId];
      return { agents: updated };
    });
  }, JUST_FINISHED_LINGER_MS);
}

export const useAgentStore = create<AgentState>()((set) => ({
  agents: {},

  addAgent: (data: AgentStatus) => {
    set((state) => ({
      agents: { ...state.agents, [data.agentId]: data },
    }));
    if (data.state === "just_finished") {
      scheduleRemoval(data.agentId, set);
    }
  },

  updateAgent: (agentId: string, update: Partial<AgentStatus>) => {
    set((state) => {
      const existing = state.agents[agentId];
      if (!existing) return {};
      return {
        agents: {
          ...state.agents,
          [agentId]: { ...existing, ...update },
        },
      };
    });
    if (update.state === "just_finished") {
      scheduleRemoval(agentId, set);
    }
  },

  removeAgent: (agentId: string) => {
    set((state) => {
      const updated = { ...state.agents };
      delete updated[agentId];
      return { agents: updated };
    });
  },

  restoreFromAPI: (statuses: AgentStatus[]) => {
    const agents: Record<string, AgentStatus> = {};
    for (const s of statuses) {
      agents[s.agentId] = s;
    }
    set({ agents });
    // Schedule removal for any just_finished agents in the snapshot
    for (const s of statuses) {
      if (s.state === "just_finished") {
        scheduleRemoval(s.agentId, set);
      }
    }
  },
}));
