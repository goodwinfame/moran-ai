/**
 * AgentStateTracker — in-memory tracker for active agent subtasks.
 *
 * Updated by the event pipeline when subtask_start / subtask_end events arrive.
 * Queried by the agent-status REST endpoint as a snapshot fallback for SSE reconnects.
 */

export interface AgentStatus {
  agentName: string;
  status: "running" | "idle";
  taskDescription?: string;
  startedAt: number; // unix ms
}

export class AgentStateTracker {
  /** projectId → Map<agentName, AgentStatus> */
  private activeAgents = new Map<string, Map<string, AgentStatus>>();

  /** Call when a subtask_start event is received */
  onSubtaskStart(
    projectId: string,
    agentName: string,
    taskDescription?: string,
  ): void {
    let projectMap = this.activeAgents.get(projectId);
    if (!projectMap) {
      projectMap = new Map();
      this.activeAgents.set(projectId, projectMap);
    }
    projectMap.set(agentName, {
      agentName,
      status: "running",
      taskDescription,
      startedAt: Date.now(),
    });
  }

  /** Call when a subtask_end event is received */
  onSubtaskEnd(projectId: string, agentName: string): void {
    const projectMap = this.activeAgents.get(projectId);
    if (!projectMap) return;
    projectMap.delete(agentName);
    if (projectMap.size === 0) {
      this.activeAgents.delete(projectId);
    }
  }

  /** Get snapshot of active agents for a project */
  getActiveAgents(projectId: string): AgentStatus[] {
    const projectMap = this.activeAgents.get(projectId);
    if (!projectMap) return [];
    return Array.from(projectMap.values());
  }

  /** Clear all tracked state for a project */
  clearProject(projectId: string): void {
    this.activeAgents.delete(projectId);
  }
}

export const agentStateTracker = new AgentStateTracker();
