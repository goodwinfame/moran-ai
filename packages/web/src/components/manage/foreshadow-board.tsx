"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Bookmark, ArrowRight } from "lucide-react";
import type { ForeshadowItem } from "@/hooks/use-project-stats";

interface ForeshadowBoardProps {
  items: ForeshadowItem[];
  loading: boolean;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  PLANTED: { label: "已埋", color: "text-green-700", bgColor: "bg-green-50 border-green-200" },
  DEVELOPING: { label: "发展中", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200" },
  RESOLVED: { label: "已揭", color: "text-gray-500", bgColor: "bg-gray-50 border-gray-200" },
  STALE: { label: "过期", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200" },
};

const columnOrder: Array<ForeshadowItem["status"]> = ["PLANTED", "DEVELOPING", "RESOLVED", "STALE"];

/**
 * §5.3.4 — Foreshadow tracking Kanban board.
 * Groups foreshadow items by status: PLANTED → DEVELOPING → RESOLVED / STALE
 */
export function ForeshadowBoard({ items, loading }: ForeshadowBoardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bookmark className="h-4 w-4" />
            伏笔追踪
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">加载中...</p>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bookmark className="h-4 w-4" />
            伏笔追踪
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">暂无伏笔数据</p>
        </CardContent>
      </Card>
    );
  }

  // Group by status
  const grouped: Record<string, ForeshadowItem[]> = {};
  for (const status of columnOrder) {
    grouped[status] = items.filter((i) => i.status === status);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bookmark className="h-4 w-4" />
          伏笔追踪
          <Badge variant="outline" className="ml-auto text-[10px]">
            {items.length} 条
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {columnOrder.map((status) => {
            const config = statusConfig[status];
            const columnItems = grouped[status] ?? [];

            return (
              <div key={status}>
                <div className="mb-2 flex items-center gap-1.5">
                  <span className={cn("text-xs font-semibold", config?.color)}>
                    {config?.label ?? status}
                  </span>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    {columnItems.length}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  {columnItems.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-md border p-2 text-xs",
                        config?.bgColor,
                      )}
                    >
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-muted-foreground">
                        {item.description}
                      </p>
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span>Ch.{item.plantedChapter}</span>
                        {item.resolvedChapter !== null && (
                          <>
                            <ArrowRight className="h-2.5 w-2.5" />
                            <span>Ch.{item.resolvedChapter}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {columnItems.length === 0 && (
                    <p className="text-[10px] text-muted-foreground/50 text-center py-2">空</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
