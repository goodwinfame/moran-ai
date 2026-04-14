"use client";

import { useState } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { ChapterList } from "@/components/read/chapter-list";
import { ChapterContent } from "@/components/read/chapter-content";
import { ChapterInfo } from "@/components/read/chapter-info";
import { useChapters, useChapterDetail } from "@/hooks/use-chapters";
import { useProjectStore } from "@/stores/project-store";

export default function ReadPage() {
  const { currentProject } = useProjectStore();
  const projectId = currentProject?.id ?? null;
  const { chapters, loading: listLoading } = useChapters(projectId);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const { chapter, loading: detailLoading } = useChapterDetail(projectId, selectedChapter);

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="📖 阅读"
        description={currentProject ? `${currentProject.name} · ${chapters.length} 章` : "浏览已完成的章节"}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chapter TOC */}
        <aside className="w-64 shrink-0 border-r border-border bg-muted/30">
          <div className="border-b border-border px-4 py-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              章节目录
            </h3>
          </div>
          <div className="h-[calc(100%-2.5rem)]">
            <ChapterList
              chapters={chapters}
              loading={listLoading}
              selectedChapter={selectedChapter}
              onSelect={setSelectedChapter}
            />
          </div>
        </aside>

        {/* Center: Chapter content */}
        <div className="flex-1 overflow-hidden">
          <ChapterContent
            content={chapter?.content ?? null}
            title={chapter?.title ?? null}
            chapterNumber={selectedChapter}
            loading={detailLoading}
          />
        </div>

        {/* Right: Info panel (xl+) */}
        <aside className="hidden w-72 shrink-0 border-l border-border bg-muted/30 overflow-auto xl:block">
          <ChapterInfo chapter={chapter ?? null} />
        </aside>
      </div>
    </div>
  );
}
