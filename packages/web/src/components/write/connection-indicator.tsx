"use client";

import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/hooks/use-streaming-write";

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
  retryCount: number;
  onRetry?: () => void;
  className?: string;
}

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  disconnected: {
    label: "未连接",
    dotClass: "bg-muted-foreground",
    textClass: "text-muted-foreground",
  },
  connecting: {
    label: "连接中…",
    dotClass: "bg-yellow-500 animate-pulse",
    textClass: "text-yellow-600",
  },
  connected: {
    label: "已连接",
    dotClass: "bg-green-500",
    textClass: "text-green-600",
  },
  reconnecting: {
    label: "重连中…",
    dotClass: "bg-orange-500 animate-pulse",
    textClass: "text-orange-600",
  },
};

/**
 * SSE 连接状态指示器
 *
 * 显示当前 SSE 连接状态（颜色圆点 + 文字），重连时显示重试次数和重试按钮。
 */
export function ConnectionIndicator({
  status,
  retryCount,
  onRetry,
  className,
}: ConnectionIndicatorProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className={cn("flex items-center gap-2 text-xs", className)}>
      <span
        className={cn("inline-block h-2 w-2 rounded-full", config.dotClass)}
        aria-label={config.label}
      />
      <span className={config.textClass}>
        {config.label}
        {status === "reconnecting" && retryCount > 0 && (
          <span className="ml-1">({retryCount})</span>
        )}
      </span>
      {(status === "disconnected" || status === "reconnecting") &&
        retryCount > 0 &&
        onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs underline text-primary hover:text-primary/80"
          >
            重试
          </button>
        )}
    </div>
  );
}
