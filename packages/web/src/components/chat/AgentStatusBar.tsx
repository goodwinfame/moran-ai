"use client";

import * as React from "react";
import { useAgentStore } from "@/stores/agent-store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface AgentStatusBarProps {
  onAgentClick: (agentId: string) => void;
}

export function AgentStatusBar({ onAgentClick }: AgentStatusBarProps) {
  const agentsRecord = useAgentStore((state) => state.agents);
  
  const agents = React.useMemo(() => {
    return Object.values(agentsRecord).sort((a, b) => a.startedAt - b.startedAt);
  }, [agentsRecord]);

  if (agents.length === 0) {
    return null;
  }

  const displayAgents = agents.slice(0, 2);
  const overflowCount = agents.length - 2;

  const getStatusColor = (state: string) => {
    switch (state) {
      case "active":
        return "bg-green-500";
      case "queued":
        return "bg-yellow-500";
      case "background":
        return "bg-blue-500";
      case "just_finished":
        return "bg-gray-400";
      default:
        return "bg-gray-400";
    }
  };

  const AgentRow = ({ agent }: { agent: typeof agents[0] }) => (
    <div
      key={agent.agentId}
      className="flex items-center gap-2 cursor-pointer hover:bg-secondary/50 p-1 rounded-md transition-colors"
      onClick={() => onAgentClick(agent.agentId)}
      data-testid="agent-row"
    >
      <div className={cn("w-2 h-2 rounded-full", getStatusColor(agent.state))} />
      <span className="text-sm font-medium text-primary-foreground/90">{agent.displayName}</span>
      <span className="text-xs text-muted-foreground">{agent.description}</span>
    </div>
  );

  return (
    <div className="px-4 py-2 border-t space-y-1 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 bg-background">
      {displayAgents.map((agent) => (
        <AgentRow key={agent.agentId} agent={agent} />
      ))}
      
      {overflowCount > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors p-1">
                +{overflowCount} 个 Agent 工作中
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" align="start" className="max-h-64 overflow-y-auto">
              <div className="space-y-2">
                {agents.slice(2).map((agent) => (
                  <div key={agent.agentId} className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", getStatusColor(agent.state))} />
                    <span className="text-sm font-medium">{agent.displayName}</span>
                    <span className="text-xs text-muted-foreground">{agent.description}</span>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
