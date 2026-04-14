"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Zap, TrendingUp } from "lucide-react";
import type { CostSummary } from "@/hooks/use-project-stats";

interface CostDashboardProps {
  cost: CostSummary | null;
}

/**
 * §5.3.4 — API cost tracking dashboard.
 * Shows total cost, per-chapter average, by-agent breakdown, daily trend.
 */
export function CostDashboard({ cost }: CostDashboardProps) {
  if (!cost) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            API 成本
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">加载中...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4" />
          API 成本
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="flex gap-4">
          <div>
            <p className="text-xs text-muted-foreground">总消耗</p>
            <p className="text-xl font-bold tabular-nums">${cost.totalCost.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">每章均价</p>
            <p className="text-xl font-bold tabular-nums">${cost.averageCostPerChapter.toFixed(2)}</p>
          </div>
        </div>

        {/* By-agent breakdown */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Agent 成本分布</p>
          <div className="space-y-2">
            {cost.byAgent.map((agent) => {
              const pct = cost.totalCost > 0 ? (agent.totalCost / cost.totalCost) * 100 : 0;
              return (
                <div key={agent.agentId} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{agent.agentName}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        ${agent.totalCost.toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/70 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] shrink-0">
                    <Zap className="mr-0.5 h-2.5 w-2.5" />
                    {agent.invocations}次
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily trend (simple text-based) */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            近7日趋势
          </p>
          <div className="grid grid-cols-7 gap-1">
            {cost.dailyTrend.map((day) => {
              const maxCost = Math.max(...cost.dailyTrend.map((d) => d.cost));
              const heightPct = maxCost > 0 ? (day.cost / maxCost) * 100 : 0;
              return (
                <div key={day.date} className="flex flex-col items-center gap-0.5">
                  <div className="w-full h-12 flex items-end">
                    <div
                      className="w-full rounded-t bg-primary/40"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-muted-foreground">
                    {day.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
