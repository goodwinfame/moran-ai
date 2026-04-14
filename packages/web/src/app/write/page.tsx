"use client";

import { useCallback } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { StreamingWriteView } from "@/components/write/streaming-write-view";
import { WriteControls } from "@/components/write/write-controls";
import { ContextOverview } from "@/components/write/context-overview";
import { WriteProgress } from "@/components/write/write-progress";
import { useStreamingWrite } from "@/hooks/use-streaming-write";
import { useProjectStore } from "@/stores/project-store";
import { api } from "@/lib/api";

export default function WritePage() {
  const { currentProject } = useProjectStore();
  const projectId = currentProject?.id ?? null;

  const {
    connect,
    disconnect,
    stage,
    content,
    wordCount,
    chapterNumber,
    budget,
    reviewResult,
    error,
    reset,
  } = useStreamingWrite(projectId);

  /** Trigger single chapter write via POST, then connect SSE */
  const handleWriteNext = useCallback(async () => {
    if (!projectId) return;
    reset();
    try {
      await api.post(`/api/projects/${projectId}/writing/next`);
      connect();
    } catch {
      // writing route will emit error via SSE
      connect();
    }
  }, [projectId, connect, reset]);

  /** Trigger continuous writing */
  const handleContinuous = useCallback(async () => {
    if (!projectId) return;
    reset();
    try {
      await api.post(`/api/projects/${projectId}/writing/continuous`, {
        targetChapters: 5,
      });
      connect();
    } catch {
      connect();
    }
  }, [projectId, connect, reset]);

  /** Stop writing */
  const handleStop = useCallback(() => {
    disconnect();
    reset();
  }, [disconnect, reset]);

  /** Reset to idle */
  const handleReset = useCallback(() => {
    disconnect();
    reset();
  }, [disconnect, reset]);

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="✍️ 写作"
        description={currentProject ? currentProject.name : "触发写作、监控写作过程"}
        actions={
          <WriteControls
            stage={stage}
            onWriteNext={handleWriteNext}
            onContinuous={handleContinuous}
            onStop={handleStop}
            onReset={handleReset}
          />
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Live writing area */}
        <div className="flex-1 overflow-hidden">
          <StreamingWriteView
            content={content}
            stage={stage}
            chapterNumber={chapterNumber}
          />
        </div>

        {/* Right: Context overview */}
        <aside className="hidden w-72 shrink-0 border-l border-border bg-muted/30 overflow-auto lg:block">
          <ContextOverview
            stage={stage}
            wordCount={wordCount}
            budget={budget}
            reviewResult={reviewResult}
            error={error}
          />
        </aside>
      </div>

      {/* Bottom: Progress bar */}
      <WriteProgress stage={stage} />
    </div>
  );
}
