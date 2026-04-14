"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { WritingStage } from "@/stores/writing-store";
import { Loader2, BookOpen } from "lucide-react";

interface StreamingWriteViewProps {
  content: string;
  stage: WritingStage;
  chapterNumber: number | null;
}

/**
 * §5.3.2 — 执笔实时输出区域
 *
 * Features:
 * - Paragraph splitting with active-paragraph highlight on last para
 * - Blinking cursor at end of content during writing
 * - Auto-scroll to bottom via scrollIntoView
 * - Idle state with call-to-action
 */
export function StreamingWriteView({ content, stage, chapterNumber }: StreamingWriteViewProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const isWriting = stage === "writing";
  const hasContent = content.length > 0;

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (isWriting && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [content, isWriting]);

  // Idle state
  if (!hasContent && stage === "idle") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <BookOpen className="h-16 w-16 text-muted-foreground/20" />
        <div className="text-center">
          <p className="text-lg text-muted-foreground">
            点击「写下一章」开始写作
          </p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            执笔将以流式方式实时输出章节内容
          </p>
        </div>
      </div>
    );
  }

  // Context building state
  if (stage === "context") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
        <div className="text-center">
          <p className="text-base font-medium text-foreground">构建写作上下文...</p>
          <p className="mt-1 text-sm text-muted-foreground">
            灵犀正在组装记忆切片、角色状态、伏笔线索
          </p>
        </div>
      </div>
    );
  }

  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);

  return (
    <ScrollArea className="h-full">
      <article className="mx-auto max-w-2xl px-8 py-8">
        {/* Chapter heading */}
        {chapterNumber !== null && (
          <header className="mb-6">
            <p className="text-sm font-medium text-muted-foreground">
              第{chapterNumber}章
              {isWriting && (
                <span className="ml-2 text-xs text-primary/70">写作中...</span>
              )}
            </p>
          </header>
        )}

        {/* Body paragraphs */}
        <div className="space-y-4 text-base leading-8 text-foreground/90">
          {paragraphs.map((para, i) => {
            const isLast = i === paragraphs.length - 1;
            return (
              <p
                key={i}
                className={cn(
                  "indent-8 rounded-sm px-2 py-0.5 transition-colors",
                  isLast && isWriting && "active-paragraph",
                )}
              >
                {para.trim()}
                {isLast && isWriting && (
                  <span className="writing-cursor ml-0.5 inline-block h-5 w-0.5 translate-y-0.5 bg-primary" />
                )}
              </p>
            );
          })}
        </div>

        {/* Scroll anchor */}
        <div ref={endRef} className="h-4" />
      </article>
    </ScrollArea>
  );
}
