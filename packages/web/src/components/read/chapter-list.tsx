"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChapterSummary } from "@/hooks/use-chapters";
import { BookOpen, Loader2 } from "lucide-react";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "草稿", variant: "secondary" },
  archived: { label: "已归档", variant: "default" },
  reviewing: { label: "审校中", variant: "outline" },
};

interface ChapterListProps {
  chapters: ChapterSummary[];
  loading: boolean;
  selectedChapter: number | null;
  onSelect: (chapterNumber: number) => void;
}

export function ChapterList({ chapters, loading, selectedChapter, onSelect }: ChapterListProps) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <BookOpen className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">暂无章节</p>
        <p className="text-xs text-muted-foreground/70">
          前往写作面板开始创作
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-0.5 p-2">
        {chapters.map((ch) => {
          const status = statusMap[ch.status] ?? { label: ch.status, variant: "secondary" as const };
          const isSelected = selectedChapter === ch.chapterNumber;

          return (
            <button
              key={ch.id}
              onClick={() => onSelect(ch.chapterNumber)}
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
                {ch.chapterNumber}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn(
                  "truncate text-sm",
                  isSelected ? "font-medium text-foreground" : "text-foreground/80",
                )}>
                  {ch.title ?? `第${ch.chapterNumber}章`}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {ch.wordCount.toLocaleString()}字
                  </span>
                  <Badge variant={status.variant} className="h-4 px-1.5 text-[10px]">
                    {status.label}
                  </Badge>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
