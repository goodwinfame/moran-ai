"use client";

import { Badge } from "@/components/ui/badge";

interface StatusBarProps {
  projectName?: string;
  agentStatus?: string;
  wordCount?: number;
  tokenUsage?: number;
}

export function StatusBar({
  projectName = "未选择项目",
  agentStatus = "空闲",
  wordCount = 0,
  tokenUsage = 0,
}: StatusBarProps) {
  return (
    <footer className="flex h-8 items-center justify-between border-t border-border bg-muted/50 px-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="font-medium">{projectName}</span>
        <Badge variant="outline" className="h-5 text-[10px]">
          {agentStatus}
        </Badge>
      </div>
      <div className="flex items-center gap-4">
        <span>{wordCount.toLocaleString()} 字</span>
        <span>{tokenUsage.toLocaleString()} tokens</span>
      </div>
    </footer>
  );
}
