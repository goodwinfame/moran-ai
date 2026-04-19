/**
 * SSE Client — EventSource wrapper with auto-reconnect and heartbeat monitoring.
 * T4: packages/web/src/lib/sse-client.ts
 */

/** All 14 SSE event types: 8 general + 3 chapter + 3 brainstorm */
export const SSE_EVENT_TYPES = [
  "text",
  "tool_call",
  "tool_result",
  "subtask_start",
  "subtask_progress",
  "subtask_end",
  "error",
  "interaction_mode",
  "chapter.start",
  "chapter.token",
  "chapter.complete",
  "brainstorm.diverge",
  "brainstorm.converge",
  "brainstorm.crystallize",
] as const;

export type SSEEventType = (typeof SSE_EVENT_TYPES)[number];

/** Handlers for each SSE event type, plus lifecycle callbacks */
export type SSEEventHandlers = {
  [K in SSEEventType]?: (data: Record<string, unknown>) => void;
} & {
  onConnect?: () => void;
  onDisconnect?: () => void;
  /** Called before each reconnect attempt; attempt is 1-based */
  onReconnect?: (attempt: number) => void;
};

const MAX_RECONNECT_DELAY_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 60_000;

/**
 * EventSource wrapper that handles:
 * - Exponential backoff reconnection (1s → 2s → 4s → ... → 30s max)
 * - Heartbeat monitoring (60s without heartbeat → force reconnect)
 * - lastEventId tracking for replay on reconnect (passed as query param)
 */
export class SSEClient {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionId: string | null = null;
  private lastEventId: string | null = null;
  private stopped = false;

  constructor(
    private readonly baseUrl: string,
    private readonly handlers: SSEEventHandlers,
  ) {}

  /** Connect to the SSE stream for the given session */
  connect(sessionId: string): void {
    this.stopped = false;
    this.sessionId = sessionId;
    this.openConnection();
  }

  /** Close the connection and stop all reconnect attempts */
  disconnect(): void {
    this.stopped = true;
    this.sessionId = null;
    this.clearReconnectTimer();
    this.clearHeartbeatMonitor();
    this.eventSource?.close();
    this.eventSource = null;
  }

  private openConnection(): void {
    if (this.stopped || this.sessionId === null) return;

    const url = new URL(`${this.baseUrl}/api/chat/events`);
    url.searchParams.set("sessionId", this.sessionId);

    // Pass lastEventId as query param for server-side replay
    if (this.lastEventId !== null) {
      url.searchParams.set("lastEventId", this.lastEventId);
    }

    this.eventSource = new EventSource(url.toString());

    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0;
      this.handlers.onConnect?.();
      this.resetHeartbeatMonitor();
    };

    // Register all 14 typed event handlers
    for (const eventType of SSE_EVENT_TYPES) {
      this.eventSource.addEventListener(eventType, (e: Event) => {
        const msg = e as MessageEvent;
        if (msg.lastEventId) {
          this.lastEventId = msg.lastEventId;
        }
        this.resetHeartbeatMonitor();
        try {
          const data = JSON.parse(msg.data as string) as Record<string, unknown>;
          this.handlers[eventType]?.(data);
        } catch (_err) {
          // Ignore malformed JSON payloads
        }
      });
    }

    // Heartbeat is an actual SSE event (not a comment) sent every 30s
    this.eventSource.addEventListener("heartbeat", () => {
      this.resetHeartbeatMonitor();
    });

    this.eventSource.onerror = () => {
      this.eventSource?.close();
      this.eventSource = null;
      this.clearHeartbeatMonitor();
      this.handlers.onDisconnect?.();
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectAttempts++;
    this.handlers.onReconnect?.(this.reconnectAttempts);

    this.reconnectTimer = setTimeout(() => {
      this.openConnection();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private resetHeartbeatMonitor(): void {
    this.clearHeartbeatMonitor();
    this.startHeartbeatMonitor();
  }

  private startHeartbeatMonitor(): void {
    this.heartbeatTimeout = setTimeout(() => {
      // 60s without heartbeat → force reconnect
      this.eventSource?.close();
      this.eventSource = null;
      this.openConnection();
    }, HEARTBEAT_TIMEOUT_MS);
  }

  private clearHeartbeatMonitor(): void {
    if (this.heartbeatTimeout !== null) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }
}
