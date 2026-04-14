"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, BookOpen } from "lucide-react";
import type { AnalysisListItem, AnalysisStatus } from "@/hooks/use-analysis";

interface AnalysisHistorySidebarProps {
  analyses: AnalysisListItem[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const statusConfig: Record<AnalysisStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "等待中", variant: "outline" },
  searching: { label: "搜索中", variant: "outline" },
  analyzing: { label: "分析中", variant: "default" },
  reporting: { label: "生成报告", variant: "default" },
  settling: { label: "沉淀中", variant: "secondary" },
  completed: { label: "已完成", variant: "default" },
  failed: { label: "失败", variant: "destructive" },
};

/**
 * §5.3.5 — Analysis history sidebar.
 * Lists past analyses grouped by work title.
 */
export function AnalysisHistorySidebar({ analyses, loading, selectedId, onSelect }: AnalysisHistorySidebarProps) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (analyses.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <BookOpen className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">暂无分析记录</p>
        <p className="text-xs text-muted-foreground/70">
          提交参考作品开始九维分析
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-0.5 p-2">
        {analyses.map((item) => {
          const config = statusConfig[item.status] ?? { label: item.status, variant: "secondary" as const };
          const isSelected = item.id === selectedId;

          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={cn(
                "flex w-full flex-col gap-1 rounded-md px-3 py-2.5 text-left transition-colors",
                isSelected
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted/50",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("text-sm font-medium truncate", isSelected && "font-semibold")}>
                  《{item.workTitle}》
                </span>
                <Badge variant={config.variant} className="shrink-0 text-[10px]">
                  {config.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{item.author}</span>
                <span>·</span>
                <span>{item.dimensionCount} 维</span>
                <span>·</span>
                <span>{item.techniqueCount} 技法</span>
              </div>
              <div className="text-[10px] text-muted-foreground/70">
                {new Date(item.createdAt).toLocaleDateString("zh-CN")}
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
