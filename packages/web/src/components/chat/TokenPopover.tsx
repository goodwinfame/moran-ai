"use client";

import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface UsageSummary {
  totalTokens: number;
  totalCostUsd: number;
  byAgent: Record<string, { tokens: number; cost: number }>;
  byModel: Record<string, { tokens: number; cost: number }>;
}

interface TokenPopoverProps {
  projectId: string;
  summary: UsageSummary | null;
  children: React.ReactNode;
}

export function TokenPopover({ summary, children }: TokenPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        {!summary ? (
          <p className="text-sm text-muted-foreground">暂无用量数据</p>
        ) : (
          <div className="space-y-4">
            <div className="border-b pb-3">
              <p className="text-sm font-medium">Token 消耗</p>
              <p className="text-2xl font-bold tabular-nums">{summary.totalTokens.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">≈ ${summary.totalCostUsd.toFixed(4)} USD</p>
            </div>

            {Object.keys(summary.byAgent).length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">按 Agent</p>
                <div className="space-y-1">
                  {Object.entries(summary.byAgent)
                    .sort(([, a], [, b]) => b.tokens - a.tokens)
                    .map(([agent, data]) => (
                      <div key={agent} className="flex justify-between text-sm">
                        <span className="truncate">{agent}</span>
                        <span className="tabular-nums text-muted-foreground">{data.tokens.toLocaleString()}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {Object.keys(summary.byModel).length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">按模型</p>
                <div className="space-y-1">
                  {Object.entries(summary.byModel)
                    .sort(([, a], [, b]) => b.tokens - a.tokens)
                    .map(([model, data]) => (
                      <div key={model} className="flex justify-between text-sm">
                        <span className="truncate">{model}</span>
                        <span className="tabular-nums text-muted-foreground">${data.cost.toFixed(4)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
