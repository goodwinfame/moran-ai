"use client";

import { useEffect, useCallback, useRef } from "react";
import { useWritingStore } from "@/stores/writing-store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3200";

/**
 * Hook for streaming write via SSE.
 * Connects to /api/projects/:id/events and dispatches events to writing store.
 *
 * §5.3.2 — 8 named event channels: context, writing, reviewing, review, archiving, done, error, heartbeat
 */
export function useStreamingWrite(projectId: string | null) {
  const store = useWritingStore();
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!projectId || typeof EventSource === "undefined") return;

    // Close existing connection
    esRef.current?.close();

    const es = new EventSource(
      `${API_BASE}/api/projects/${projectId}/events`,
    );
    esRef.current = es;

    es.addEventListener("context", (e) => {
      try {
        const data = JSON.parse(e.data);
        store.setStage("context");
        if (data.budget) {
          store.setBudget(data.budget);
        }
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("writing", (e) => {
      try {
        const data = JSON.parse(e.data);
        store.setStage("writing");
        if (data.chunk) {
          store.appendContent(data.chunk);
        }
        if (typeof data.wordCount === "number") {
          store.setWordCount(data.wordCount);
        }
        if (typeof data.chapterNumber === "number") {
          store.setChapterNumber(data.chapterNumber);
        }
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("reviewing", () => {
      store.setStage("reviewing");
    });

    es.addEventListener("review", (e) => {
      try {
        const data = JSON.parse(e.data);
        store.setReviewResult(data);
      } catch {
        // ignore
      }
    });

    es.addEventListener("archiving", () => {
      store.setStage("archiving");
    });

    es.addEventListener("done", () => {
      store.setStage("done");
      esRef.current?.close();
    });

    es.addEventListener("error", (e) => {
      if (e instanceof MessageEvent && e.data) {
        store.setError(e.data);
      } else {
        store.setError("连接中断");
      }
    });

    es.addEventListener("heartbeat", () => {
      // Keep connection alive, no UI update needed
    });

    // Native EventSource error (connection lost)
    es.onerror = () => {
      // EventSource auto-reconnects by default
      // Only set error if readyState is CLOSED (permanent failure)
      if (es.readyState === EventSource.CLOSED) {
        store.setError("SSE 连接已关闭");
      }
    };
  }, [projectId]);

  const disconnect = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  const isConnected =
    typeof EventSource !== "undefined" &&
    esRef.current?.readyState === EventSource.OPEN;

  return {
    connect,
    disconnect,
    isConnected,
    ...store,
  };
}
