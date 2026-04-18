"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useStreamingWrite } from "@/hooks/use-streaming-write";
import { ConnectionIndicator } from "@/components/write/connection-indicator";
import { ContextOverview } from "@/components/write/context-overview";
import { StreamingWriteView } from "@/components/write/streaming-write-view";
import { WriteControls } from "@/components/write/write-controls";
import { WriteProgress } from "@/components/write/write-progress";

import { API_BASE } from "@/lib/api";

/**
 * §5.3.2 — 执笔写作页面
 *
 * Layout: top controls + connection indicator, center streaming view + right context sidebar, bottom progress bar.
 * Flow: "写下一章" → connect SSE → POST /writing/next → events stream in → done.
 * Continuous mode auto-starts next chapter after 2s pause.
 */
export default function WritePage() {
  const params = useParams();
  const projectId = params.id as string;

  const [continuous, setContinuous] = useState(false);

  const {
    connect,
    disconnect,
    retry,
    connectionStatus,
    retryCount,
    stage,
    content,
    wordCount,
    chapterNumber,
    reviewResult,
    budget,
    error,
    reset,
    setError,
  } = useStreamingWrite(projectId);

  /** Start writing: connect SSE first (to be ready for events), then POST to trigger pipeline */
  const startWriting = useCallback(async () => {
    reset();
    connect();
    try {
      const res = await fetch(
        `${API_BASE}/api/projects/${projectId}/writing/next`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      if (!res.ok) {
        const data: { error?: string } | null = await res
          .json()
          .catch(() => null);
        setError(data?.error ?? `写作启动失败 (${res.status})`);
        disconnect();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "写作启动失败";
      setError(msg);
      disconnect();
    }
  }, [projectId, connect, disconnect, reset, setError]);

  /** Auto-continue in continuous mode after chapter finishes */
  useEffect(() => {
    if (continuous && stage === "done") {
      const timer = setTimeout(() => {
        void startWriting();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [continuous, stage, startWriting]);

  const handleWriteNext = useCallback(() => {
    setContinuous(false);
    void startWriting();
  }, [startWriting]);

  const handleContinuous = useCallback(() => {
    setContinuous(true);
    void startWriting();
  }, [startWriting]);

  const handleStop = useCallback(() => {
    setContinuous(false);
    disconnect();
  }, [disconnect]);

  const handleReset = useCallback(() => {
    setContinuous(false);
    disconnect();
    reset();
  }, [disconnect, reset]);

  return (
    <div className="flex h-full flex-col">
      {/* Top bar: controls + connection status */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-3">
          <WriteControls
            stage={stage}
            onWriteNext={handleWriteNext}
            onContinuous={handleContinuous}
            onStop={handleStop}
            onReset={handleReset}
          />
          {continuous && (stage === "writing" || stage === "done") && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              连续模式
            </span>
          )}
        </div>
        <ConnectionIndicator
          status={connectionStatus}
          retryCount={retryCount}
          onRetry={retry}
        />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Center: streaming write view */}
        <div className="flex-1 overflow-hidden">
          <StreamingWriteView
            content={content}
            stage={stage}
            chapterNumber={chapterNumber}
          />
        </div>

        {/* Right sidebar: context overview */}
        <div className="w-72 shrink-0 overflow-y-auto border-l border-border bg-card">
          <ContextOverview
            stage={stage}
            wordCount={wordCount}
            budget={budget}
            reviewResult={reviewResult}
            error={error}
          />
        </div>
      </div>

      {/* Bottom: progress bar */}
      <WriteProgress stage={stage} />
    </div>
  );
}
