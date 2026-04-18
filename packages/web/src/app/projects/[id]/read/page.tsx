"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useChapters, useChapterDetail } from "@/hooks/use-chapters";
import { ChapterList } from "@/components/read/chapter-list";
import { ChapterContent } from "@/components/read/chapter-content";
import { ChapterInfo } from "@/components/read/chapter-info";

/**
 * §5.3.4 — 阅读页面
 *
 * Three-column layout: left chapter list, center reading view, right chapter info sidebar.
 * Uses useChapters for the list and useChapterDetail for the selected chapter's full content.
 */
export default function ReadPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);

  const { chapters, loading: listLoading } = useChapters(projectId);
  const { chapter, loading: detailLoading } = useChapterDetail(
    projectId,
    selectedChapter,
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar: chapter list */}
      <div className="w-64 shrink-0 border-r border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">章节列表</h2>
          {chapters.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              共 {chapters.length} 章 ·{" "}
              {chapters
                .reduce((sum, ch) => sum + ch.wordCount, 0)
                .toLocaleString()}{" "}
              字
            </p>
          )}
        </div>
        <ChapterList
          chapters={chapters}
          loading={listLoading}
          selectedChapter={selectedChapter}
          onSelect={setSelectedChapter}
        />
      </div>

      {/* Center: chapter content */}
      <div className="flex-1 overflow-hidden">
        <ChapterContent
          content={chapter?.content ?? null}
          title={chapter?.title ?? null}
          chapterNumber={selectedChapter}
          loading={detailLoading}
        />
      </div>

      {/* Right sidebar: chapter info */}
      <div className="w-64 shrink-0 overflow-y-auto border-l border-border bg-card">
        <ChapterInfo chapter={chapter} />
      </div>
    </div>
  );
}
