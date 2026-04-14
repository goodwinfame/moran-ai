"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Database, Flame, Thermometer, Snowflake } from "lucide-react";
import type { UNMHealth } from "@/hooks/use-project-stats";

interface UNMHealthCardProps {
  health: UNMHealth | null;
}

const tierConfig = [
  { key: "hot" as const, label: "HOT", icon: Flame, color: "text-red-500", barColor: "bg-red-400" },
  { key: "warm" as const, label: "WARM", icon: Thermometer, color: "text-amber-500", barColor: "bg-amber-400" },
  { key: "cold" as const, label: "COLD", icon: Snowflake, color: "text-blue-500", barColor: "bg-blue-400" },
];

/**
 * §5.3.4 — UNM memory health panel.
 * Shows HOT/WARM/COLD tier distribution overall and per-category.
 */
export function UNMHealthCard({ health }: UNMHealthCardProps) {
  if (!health) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" />
            UNM 健康
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
          <Database className="h-4 w-4" />
          UNM 健康
          <Badge variant="outline" className="ml-auto text-[10px]">
            {health.total} 切片
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall tier distribution */}
        <div className="flex gap-4">
          {tierConfig.map((tier) => {
            const Icon = tier.icon;
            return (
              <div key={tier.key} className="flex items-center gap-1.5">
                <Icon className={cn("h-4 w-4", tier.color)} />
                <div>
                  <p className="text-[10px] text-muted-foreground">{tier.label}</p>
                  <p className="text-sm font-semibold tabular-nums">{health[tier.key]}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Stacked bar visualization */}
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted flex">
          {tierConfig.map((tier) => {
            const pct = health.total > 0 ? (health[tier.key] / health.total) * 100 : 0;
            return (
              <div
                key={tier.key}
                className={cn("h-full transition-all", tier.barColor)}
                style={{ width: `${pct}%` }}
              />
            );
          })}
        </div>

        {/* Per-category breakdown */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">分类别分布</p>
          <div className="space-y-1.5">
            {Object.entries(health.byCategory).map(([category, tiers]) => {
              const catTotal = tiers.hot + tiers.warm + tiers.cold;
              return (
                <div key={category} className="flex items-center gap-2 text-xs">
                  <span className="w-16 text-muted-foreground truncate">{category}</span>
                  <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-muted flex">
                    {catTotal > 0 && (
                      <>
                        <div className="h-full bg-red-400" style={{ width: `${(tiers.hot / catTotal) * 100}%` }} />
                        <div className="h-full bg-amber-400" style={{ width: `${(tiers.warm / catTotal) * 100}%` }} />
                        <div className="h-full bg-blue-400" style={{ width: `${(tiers.cold / catTotal) * 100}%` }} />
                      </>
                    )}
                  </div>
                  <span className="w-8 text-right text-muted-foreground tabular-nums">{catTotal}</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
