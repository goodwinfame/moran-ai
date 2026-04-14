"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useWritingStore } from "@/stores/writing-store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3200";

/** 重连配置 */
const RECONNECT_CONFIG = {
  /** 初始重连延迟 (ms) */
  initialDelay: 1000,
  /** 最大重连延迟 (ms) */
  maxDelay: 30_000,
  /** 退避倍数 */
  backoffMultiplier: 2,
  /** 最大重连次数（0 = 无限） */
  maxRetries: 10,
  /** 添加随机抖动 (0~1)，减少雷群效应 */
  jitter: 0.3,
} as const;

/** 连接状态 */
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

/**
 * Hook for streaming write via SSE.
 * Connects to /api/projects/:id/events and dispatches events to writing store.
 *
 * M3.6: 增强版 — 支持断线自动重连 + Last-Event-ID 恢复 + 指数退避
 *
 * §5.3.2 — 8 named event channels: context, writing, reviewing, review, archiving, done, error, heartbeat
 */
export function useStreamingWrite(projectId: string | null) {
  const store = useWritingStore();
  const esRef = useRef<EventSource | null>(null);
  const lastEventIdRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [retryCount, setRetryCount] = useState(0);

  /** 计算下一次重连延迟（指数退避 + 抖动） */
  const getRetryDelay = useCallback((attempt: number): number => {
    const base = RECONNECT_CONFIG.initialDelay * Math.pow(RECONNECT_CONFIG.backoffMultiplier, attempt);
    const capped = Math.min(base, RECONNECT_CONFIG.maxDelay);
    const jitter = capped * RECONNECT_CONFIG.jitter * Math.random();
    return capped + jitter;
  }, []);

  /** 清理重连定时器 */
  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  /** 核心连接函数 */
  const doConnect = useCallback(
    (isReconnect = false) => {
      if (!projectId || typeof EventSource === "undefined") return;

      // 关闭现有连接
      esRef.current?.close();

      setConnectionStatus(isReconnect ? "reconnecting" : "connecting");

      // 构建 URL，附加 Last-Event-ID query 参数
      // （因为 EventSource 不支持自定义请求头，用 query param 作为 fallback）
      let url = `${API_BASE}/api/projects/${projectId}/events`;
      if (isReconnect && lastEventIdRef.current) {
        url += `?lastEventId=${lastEventIdRef.current}`;
      }

      const es = new EventSource(url);
      esRef.current = es;

      /** 更新 Last-Event-ID */
      const trackEventId = (e: MessageEvent) => {
        if (e.lastEventId) {
          lastEventIdRef.current = e.lastEventId;
        }
      };

      es.addEventListener("context", (e: MessageEvent) => {
        trackEventId(e);
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

      es.addEventListener("writing", (e: MessageEvent) => {
        trackEventId(e);
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

      es.addEventListener("reviewing", (e: MessageEvent) => {
        trackEventId(e);
        store.setStage("reviewing");
      });

      es.addEventListener("review", (e: MessageEvent) => {
        trackEventId(e);
        try {
          const data = JSON.parse(e.data);
          store.setReviewResult(data);
        } catch {
          // ignore
        }
      });

      es.addEventListener("archiving", (e: MessageEvent) => {
        trackEventId(e);
        store.setStage("archiving");
      });

      es.addEventListener("done", (e: MessageEvent) => {
        trackEventId(e);
        store.setStage("done");
        // 写作完成，主动关闭连接
        intentionalCloseRef.current = true;
        es.close();
        setConnectionStatus("disconnected");
      });

      es.addEventListener("error", (e) => {
        if (e instanceof MessageEvent) {
          trackEventId(e);
          if (e.data) {
            try {
              const data = JSON.parse(e.data);
              const recoverable = data.recoverable !== false;
              store.setError(data.message ?? "未知错误");
              if (!recoverable) {
                intentionalCloseRef.current = true;
                es.close();
                setConnectionStatus("disconnected");
              }
            } catch {
              store.setError(e.data);
            }
          }
        }
        // 注意：非 MessageEvent 的 error 由 onerror 处理
      });

      es.addEventListener("heartbeat", (e: MessageEvent) => {
        trackEventId(e);
        // 心跳收到 = 连接正常
        if (connectionStatus !== "connected") {
          setConnectionStatus("connected");
          // 重连成功，重置重试计数
          retryCountRef.current = 0;
          setRetryCount(0);
        }
      });

      // 重连失败事件（Last-Event-ID 过期）
      es.addEventListener("reconnect-failed", (e: MessageEvent) => {
        trackEventId(e);
        try {
          const data = JSON.parse(e.data);
          store.setError(`重连失败：${data.message ?? "事件已过期"}`);
        } catch {
          store.setError("重连失败：事件缓冲区已过期");
        }
        // 重置 lastEventId，下次重连从头开始
        lastEventIdRef.current = null;
      });

      es.onopen = () => {
        setConnectionStatus("connected");
        retryCountRef.current = 0;
        setRetryCount(0);
      };

      // 原生 EventSource error（连接丢失）
      es.onerror = () => {
        if (intentionalCloseRef.current) return;

        // EventSource 会自动尝试重连，但我们需要自定义逻辑
        // 因为需要附加 Last-Event-ID query param
        if (es.readyState === EventSource.CLOSED) {
          setConnectionStatus("disconnected");

          // 检查重试限制
          if (
            RECONNECT_CONFIG.maxRetries > 0 &&
            retryCountRef.current >= RECONNECT_CONFIG.maxRetries
          ) {
            store.setError(`SSE 连接已断开，已重试 ${retryCountRef.current} 次`);
            return;
          }

          // 指数退避重连
          const delay = getRetryDelay(retryCountRef.current);
          retryCountRef.current += 1;
          setRetryCount(retryCountRef.current);

          clearRetryTimer();
          retryTimerRef.current = setTimeout(() => {
            doConnect(true);
          }, delay);
        } else if (es.readyState === EventSource.CONNECTING) {
          setConnectionStatus("reconnecting");
        }
      };
    },
    [projectId, getRetryDelay, clearRetryTimer, connectionStatus, store],
  );

  /** 公开的连接方法 */
  const connect = useCallback(() => {
    intentionalCloseRef.current = false;
    retryCountRef.current = 0;
    setRetryCount(0);
    lastEventIdRef.current = null;
    doConnect(false);
  }, [doConnect]);

  /** 公开的断开方法 */
  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearRetryTimer();
    esRef.current?.close();
    esRef.current = null;
    setConnectionStatus("disconnected");
    retryCountRef.current = 0;
    setRetryCount(0);
  }, [clearRetryTimer]);

  /** 手动重试（用户点击"重试"按钮） */
  const retry = useCallback(() => {
    store.setError(null);
    retryCountRef.current = 0;
    setRetryCount(0);
    intentionalCloseRef.current = false;
    doConnect(true);
  }, [doConnect, store]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      clearRetryTimer();
      esRef.current?.close();
    };
  }, [clearRetryTimer]);

  return {
    connect,
    disconnect,
    retry,
    connectionStatus,
    retryCount,
    isConnected: connectionStatus === "connected",
    lastEventId: lastEventIdRef.current,
    ...store,
  };
}
