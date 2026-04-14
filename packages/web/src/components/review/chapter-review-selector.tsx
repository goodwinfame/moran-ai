"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileSearch } from "lucide-react";

export interface ReviewSummary {
  chapterNumber: number;
  chapterTitle: string | null;
  status: string;
  latestScore: number | null;
  roundCount: number;
}

interface ChapterReviewSelectorProps {
  reviews: ReviewSummary[];
  loading: boolean;
  selectedChapter: number | null;
  onSelect: (chapterNumber: number) => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  passed: { label: "通过", variant: "default" },
  "force-passed": { label: "强制通过", variant: "secondary" },
  failed: { label: "未通过", variant: "destructive" },
  reviewing: { label: "审校中", variant: "outline" },
  pending: { label: "待审", variant: "secondary" },
};

/**
 * §5.3.3 — Chapter selector for review panel.
 * Lists chapters with their review status and score.
 */
export function ChapterReviewSelector({ reviews, loading, selectedChapter, onSelect }: ChapterReviewSelectorProps) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <FileSearch className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">暂无审校数据</p>
        <p className="text-xs text-muted-foreground/70">
          完成写作后将自动进入审校
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-0.5 p-2">
        {reviews.map((r) => {
          const config = statusConfig[r.status] ?? { label: r.status, variant: "secondary" as const };
          const isSelected = selectedChapter === r.chapterNumber;

          return (
            <button
              key={r.chapterNumber}
              onClick={() => onSelect(r.chapterNumber)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                "hover:bg-accent",
                isSelected && "bg-accent/80 shadow-sm",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-medium",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {r.chapterNumber}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn(
                  "truncate text-sm",
                  isSelected ? "font-medium text-foreground" : "text-foreground/80",
                )}>
                  {r.chapterTitle ?? `第${r.chapterNumber}章`}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  {r.latestScore !== null && (
                    <span className={cn(
                      "text-xs font-medium",
                      r.latestScore >= 80 ? "text-green-600" :
                      r.latestScore >= 60 ? "text-amber-600" :
                      "text-red-600",
                    )}>
                      {r.latestScore}分
                    </span>
                  )}
                  <Badge variant={config.variant} className="h-4 px-1.5 text-[10px]">
                    {config.label}
                  </Badge>
                  {r.roundCount > 1 && (
                    <span className="text-[10px] text-muted-foreground">
                      {r.roundCount}轮
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
