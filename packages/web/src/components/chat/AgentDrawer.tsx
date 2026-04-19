"use client";

import * as React from "react";
import { Icon } from "@/components/ui/icon";
import { useAgentStore } from "@/stores/agent-store";

interface AgentDrawerProps {
  agentId: string | null;
  onClose: () => void;
}

export function AgentDrawer({ agentId, onClose }: AgentDrawerProps) {
  const agent = useAgentStore((state) => 
    agentId ? state.agents[agentId] : null
  );

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (agentId) {
      window.addEventListener("keydown", handleEscape);
    }
    return () => window.removeEventListener("keydown", handleEscape);
  }, [agentId, onClose]);

  if (!agentId) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-40 bg-black/20 animate-in fade-in duration-300" 
        onClick={onClose} 
        data-testid="backdrop"
      />
      <div 
        className="fixed top-0 right-0 bottom-0 w-[320px] bg-background border-l shadow-xl z-50 flex flex-col transition-transform duration-300 animate-in slide-in-from-right"
        data-testid="drawer"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex flex-col overflow-hidden mr-2">
            <h3 className="font-semibold text-base truncate">{agent?.displayName || "Agent"}</h3>
            <span className="text-xs text-muted-foreground truncate">{agent?.description || "任务执行中"}</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-secondary rounded-full transition-colors shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <Icon name="close" size={20} filled />
          </button>
        </div>
        <div className="flex-1 p-4 overflow-y-auto bg-secondary/10">
          <div className="text-center text-sm text-muted-foreground mt-10">
            Agent 工作日志
          </div>
        </div>
      </div>
    </>
  );
}
