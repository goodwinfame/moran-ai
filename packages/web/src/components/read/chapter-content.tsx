"use client";

import { Loader2, BookOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChapterContentProps {
  content: string | null;
  title: string | null;
  chapterNumber: number | null;
  loading: boolean;
}

/**
 * Renders chapter text content.
 * Splits content by paragraph (`\n\n`) and renders with proper typography.
 */
export function ChapterContent({ content, title, chapterNumber, loading }: ChapterContentProps) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!content || chapterNumber === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <BookOpen className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">选择左侧章节开始阅读</p>
      </div>
    );
  }

  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);

  return (
    <ScrollArea className="h-full">
      <article className="mx-auto max-w-2xl px-8 py-8">
        {/* Chapter heading */}
        <header className="mb-8 border-b border-border pb-6">
          <p className="text-sm font-medium text-muted-foreground">
            第{chapterNumber}章
          </p>
          {title && (
            <h2 className="mt-1 text-2xl font-bold tracking-tight">{title}</h2>
          )}
        </header>

        {/* Body paragraphs */}
        <div className="space-y-4 text-base leading-8 text-foreground/90">
          {paragraphs.map((para, i) => (
            <p key={i} className="indent-8">
              {para.trim()}
            </p>
          ))}
        </div>

        {/* End marker */}
        <div className="mt-12 flex items-center justify-center gap-2 text-muted-foreground/40">
          <span className="h-px w-8 bg-current" />
          <span className="text-xs">完</span>
          <span className="h-px w-8 bg-current" />
        </div>
      </article>
    </ScrollArea>
  );
}
