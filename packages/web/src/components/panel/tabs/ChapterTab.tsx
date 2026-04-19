"use client";

import { useEffect, useRef, useState } from "react";
import { usePanelStore } from "@/stores/panel-store";
import type { ChapterData } from "@/stores/panel-store";
import { cn } from "@/lib/utils";
import { TabEmptyState } from "../shared/TabEmptyState";
import { Icon } from "@/components/ui/icon";

export function ChapterTab() {
  const data = usePanelStore((s) => s.chapters);
  
  if (!data) {
    return <TabEmptyState text="还没有章节内容。大纲完善后，告诉墨衡'开始写第一章'..." icon="📝" />;
  }

  if (data.mode === "writing") {
    return <WritingMode data={data} />;
  }

  return <ReadingMode data={data} />;
}

function WritingMode({ data }: { data: ChapterData }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const [autoFollow, setAutoFollow] = useState(data.isAutoFollow);

  // Auto scroll logic
  useEffect(() => {
    if (autoFollow && bottomSentinelRef.current) {
      bottomSentinelRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [data.streamingContent, autoFollow]);

  // Stop auto follow on manual scroll up
  const handleScroll = () => {
    if (!contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    // Allow a small threshold (e.g., 20px) to consider it "at the bottom"
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;
    
    if (!isAtBottom && autoFollow) {
      setAutoFollow(false);
    } else if (isAtBottom && !autoFollow) {
      setAutoFollow(true);
    }
  };

  const resumeAutoFollow = () => {
    setAutoFollow(true);
    if (bottomSentinelRef.current) {
      bottomSentinelRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const progress = data.writingProgress;
  const percent = progress && progress.target > 0 ? Math.min(100, Math.round((progress.current / progress.target) * 100)) : 0;

  return (
    <div className="flex flex-col h-full relative">
      <div className="px-4 py-3 border-b bg-background sticky top-0 z-10">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span className="font-medium">{progress?.current ?? 0} / {progress?.target ?? 0} 字</span>
          <span className="font-medium text-primary">{percent}%</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-primary h-full transition-all duration-300 ease-out" 
            style={{ width: `${percent}%` }} 
          />
        </div>
      </div>
      
      <div 
        ref={contentRef} 
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 font-serif leading-relaxed text-base tracking-wide whitespace-pre-wrap"
      >
        {data.streamingContent}
        <span className="inline-block w-2 h-[1.1em] bg-primary animate-pulse align-middle ml-1"></span>
        <div ref={bottomSentinelRef} className="h-4" />
      </div>

      {!autoFollow && (
        <button 
          onClick={resumeAutoFollow}
          className="absolute bottom-6 right-6 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm shadow-md hover:bg-primary/90 flex items-center gap-2 transition-all"
        >
          <Icon name="arrow-down" size={14} /> 回到最新
        </button>
      )}
    </div>
  );
}

function ReadingMode({ data }: { data: ChapterData }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(data.selectedChapter);

  const activeChapter = data.chapterList.find(c => c.number === selectedChapter);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-48 border-r bg-muted/10 shrink-0 overflow-y-auto hidden md:block">
          <div className="p-3 border-b font-medium text-sm sticky top-0 bg-background/95 backdrop-blur">
            章节列表
          </div>
          <div className="p-2 flex flex-col gap-1">
            {data.chapterList.map((ch) => (
              <button
                key={ch.number}
                onClick={() => setSelectedChapter(ch.number)}
                className={cn(
                  "text-left px-3 py-2 text-sm rounded-md transition-colors truncate",
                  selectedChapter === ch.number
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-accent text-foreground"
                )}
              >
                第{ch.number}章 {ch.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {activeChapter ? (
          <>
            <div className="px-4 py-3 border-b bg-background flex flex-wrap items-center gap-4 text-xs text-muted-foreground shrink-0">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hidden md:flex p-1 hover:bg-accent rounded text-foreground"
                title={sidebarOpen ? "隐藏列表" : "显示列表"}
              >
                <Icon name="menu" size={16} />
              </button>
              <h3 className="font-semibold text-sm text-foreground truncate mr-auto">
                第{activeChapter.number}章：{activeChapter.title}
              </h3>
              <div className="flex items-center gap-4">
                <span><span className="font-medium">字数：</span>{activeChapter.wordCount}</span>
                <span><span className="font-medium">状态：</span>{activeChapter.status}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
              <div className="max-w-3xl mx-auto font-serif leading-relaxed text-base md:text-lg whitespace-pre-wrap text-foreground/90">
                {data.streamingContent || <span className="text-muted-foreground italic">选择章节以阅读内容</span>}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            请在左侧选择要阅读的章节
          </div>
        )}
      </div>
    </div>
  );
}
