/**
 * OpenCode SessionManager
 *
 * 职责：
 * 1. 管理 opencode serve 子进程的生命周期（启动/健康检查/重启）
 * 2. 维护 (userId, projectId) → OpenCode sessionId 的映射
 * 3. Session 超时自动释放（默认 30 分钟不活跃）
 *
 * 设计原则：
 * - opencode serve 是单个共享子进程，支持多 session 并发
 * - 每个 (userId, projectId) 独占一个 OpenCode session，互相隔离
 * - SessionManager 是 Hono 应用级单例，在 index.ts 启动时初始化
 */

import { createOpencodeClient } from "@opencode-ai/sdk";
import type { OpencodeClient, Message, Part } from "@opencode-ai/sdk";
import { createLogger } from "@moran/core/logger";

const log = createLogger("opencode-manager");

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 分钟

interface ManagedSession {
  sessionId: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface SessionManagerOptions {
  /** opencode serve 的地址，默认 http://127.0.0.1:4096 */
  baseUrl?: string;
  /** Session 不活跃超时时长（ms），默认 30 分钟 */
  ttlMs?: number;
}

export interface MessageWithParts {
  info: Message;
  parts: Part[];
}

export interface SendMessageOptions {
  /** Target agent name (e.g., "lingxi", "jiangxin") */
  agent?: string;
}

export interface SendMessageResult {
  messageId: string;
}

export interface OpenCodeEvent {
  type: string;
  sessionId?: string;
  data: unknown;
}

export class OpenCodeSessionManager {
  private readonly baseUrl: string;
  private readonly ttlMs: number;
  private readonly sessions = new Map<string, ManagedSession>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /** key = sessionId, value = set of listeners for that session */
  private readonly globalListeners = new Map<string, Set<(event: OpenCodeEvent) => void>>();
  /** Whether the singleton global OpenCode SSE subscription is active */
  private globalEventActive = false;

  constructor(options: SessionManagerOptions = {}) {
    this.baseUrl = options.baseUrl ?? process.env.OPENCODE_BASE_URL ?? "http://127.0.0.1:4096";
    this.ttlMs = options.ttlMs ?? SESSION_TTL_MS;
  }

  /** 创建 SDK 客户端（每次请求按需创建，无状态） */
  createClient(): OpencodeClient {
    return createOpencodeClient({ baseUrl: this.baseUrl });
  }

  /** 组合 session key */
  private key(userId: string, projectId: string): string {
    return `${userId}:${projectId}`;
  }

  /**
   * 获取或创建 (userId, projectId) 对应的 OpenCode sessionId
   * 第一次调用会向 opencode 创建 session 并注入系统提示
   */
  async getOrCreateSession(
    userId: string,
    projectId: string,
    onNew?: (client: OpencodeClient, sessionId: string) => Promise<void>,
  ): Promise<string> {
    const k = this.key(userId, projectId);
    const existing = this.sessions.get(k);

    if (existing) {
      existing.lastActiveAt = Date.now();
      return existing.sessionId;
    }

    // 创建新 session
    const client = this.createClient();
    const res = await client.session.create({
      body: { title: `moran-${userId}-${projectId}` },
    });
    const sessionId = res.data?.id;
    if (!sessionId) {
      throw new Error("OpenCode session.create returned no id");
    }

    this.sessions.set(k, {
      sessionId,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    log.info({ userId, projectId, sessionId }, "OpenCode session created");

    // 回调：让调用方注入系统提示等初始化逻辑
    if (onNew) {
      await onNew(client, sessionId);
    }

    return sessionId;
  }

  /**
   * 主动释放 session（用户退出项目时调用）
   */
  release(userId: string, projectId: string): void {
    const k = this.key(userId, projectId);
    this.sessions.delete(k);
    log.info({ userId, projectId }, "OpenCode session released");
  }

  /**
   * 检查 opencode serve 是否可达
   * 启动时调用，不可达则抛出明确错误
   */
  async checkHealth(): Promise<void> {
    const url = `${this.baseUrl}/global/health`;
    try {
      const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(3000) });
      // 任何 HTTP 响应（包括 4xx）都说明 serve 在跑
      log.info({ baseUrl: this.baseUrl, status: res.status }, "OpenCode serve 健康检查通过");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `OpenCode serve 不可达（${this.baseUrl}）：${msg}\n` +
          `请确认 opencode serve 已启动，或通过 OPENCODE_BASE_URL 环境变量指定正确地址。`,
      );
    }
  }

  /**
   * 启动定时清理（每 5 分钟扫描一次过期 session）
   */
  startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.sweep(), 5 * 60 * 1000);
    log.info({ ttlMs: this.ttlMs }, "Session cleanup started");
  }

  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private sweep(): void {
    const now = Date.now();
    let count = 0;
    for (const [k, s] of this.sessions) {
      if (now - s.lastActiveAt >= this.ttlMs) {
        this.sessions.delete(k);
        count++;
      }
    }
    if (count > 0) {
      log.info({ evicted: count }, "Expired sessions swept");
    }
  }

  /** 当前活跃 session 数（用于健康检查/监控） */
  get activeCount(): number {
    return this.sessions.size;
  }

  /**
   * 服务重启时恢复 session 映射
   * 通过 OpenCode SDK session.list() 重建内存 Map
   */
  async restore(): Promise<number> {
    const client = this.createClient();
    const res = await client.session.list();
    const sessions = res.data ?? [];
    let count = 0;
    for (const s of sessions) {
      const match = s.title.match(/^moran-(.+?)-(.+)$/);
      if (!match) continue;
      const userId = match[1];
      const projectId = match[2];
      if (!userId || !projectId) continue;
      const k = this.key(userId, projectId);
      if (!this.sessions.has(k)) {
        this.sessions.set(k, {
          sessionId: s.id,
          createdAt: s.time.created,
          lastActiveAt: s.time.updated,
        });
        count++;
      }
    }
    log.info({ restored: count }, "Sessions restored from OpenCode");
    return count;
  }

  /**
   * 获取指定 session 的消息历史
   */
  async getMessages(
    sessionId: string,
    options?: { limit?: number },
  ): Promise<MessageWithParts[]> {
    const client = this.createClient();
    const res = await client.session.messages({
      path: { id: sessionId },
      query: { limit: options?.limit },
    });
    return (res.data ?? []) as MessageWithParts[];
  }

  /**
   * 向 session 发送消息（fire-and-forget）
   */
  async sendMessage(
    sessionId: string,
    content: string,
    options?: SendMessageOptions,
  ): Promise<SendMessageResult> {
    const client = this.createClient();
    const res = await client.session.promptAsync({
      path: { id: sessionId },
      body: {
        parts: [{ type: "text" as const, text: content }],
        agent: options?.agent,
      },
    });
    const messageId =
      (res.data as unknown as { info?: { id?: string } })?.info?.id ?? "";
    return { messageId };
  }

  /**
   * 启动单例全局 OpenCode SSE 订阅（fire-and-forget）
   * 如果已在运行则立即返回。断开后若还有监听器则 1 秒后自动重连。
   */
  private startGlobalSubscription(): void {
    if (this.globalEventActive) return;
    this.globalEventActive = true;

    // Fire-and-forget — intentionally not awaited
    void (async () => {
      try {
        // At runtime the SSE stream yields GlobalEvent objects: { directory, payload }.
        // The SDK's generic parameter doesn't match runtime shape (same issue as before).
        const result = await this.createClient().global.event();
        const events = result.stream as unknown as AsyncIterable<{
          payload: { type: string; properties: Record<string, unknown> };
        }>;

        for await (const raw of events) {
          const payload = raw.payload;
          if (!payload) continue;
          const eventType = payload.type ?? "";
          const props = (payload.properties ?? {}) as Record<string, unknown>;
          const eventSessionId =
            (props["sessionID"] as string | undefined) ??
            (props["info"] as { sessionID?: string } | undefined)?.sessionID ??
            (props["part"] as { sessionID?: string } | undefined)?.sessionID;

          if (eventSessionId) {
            const listeners = this.globalListeners.get(eventSessionId);
            if (listeners) {
              const event: OpenCodeEvent = {
                type: eventType,
                sessionId: eventSessionId,
                data: props,
              };
              for (const listener of listeners) listener(event);
            }
          }
        }
      } catch (err) {
        log.warn({ err }, "Global OpenCode SSE connection error");
      } finally {
        this.globalEventActive = false;
        // Reconnect after 1 second if there are still active listeners
        if (this.globalListeners.size > 0) {
          setTimeout(() => this.startGlobalSubscription(), 1000);
        }
      }
    })();
  }

  /**
   * 订阅 session 事件流（单例全局连接 + 按 sessionId 分发）
   * 返回过滤后的 ReadableStream，仅包含该 session 的事件
   */
  subscribeEvents(sessionId: string): {
    stream: ReadableStream<OpenCodeEvent>;
    close: () => void;
  } {
    let controller: ReadableStreamDefaultController<OpenCodeEvent> | null = null;

    const listener = (event: OpenCodeEvent): void => {
      try {
        controller?.enqueue(event);
      } catch {
        // Stream already closed — ignore
      }
    };

    // Register listener before starting subscription so no events are missed
    if (!this.globalListeners.has(sessionId)) {
      this.globalListeners.set(sessionId, new Set());
    }
    this.globalListeners.get(sessionId)!.add(listener);

    // Ensure the singleton global subscription is running
    this.startGlobalSubscription();

    const stream = new ReadableStream<OpenCodeEvent>({
      start(ctrl) {
        controller = ctrl;
      },
      cancel() {
        // Cleanup handled by close()
      },
    });

    const close = (): void => {
      const set = this.globalListeners.get(sessionId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) this.globalListeners.delete(sessionId);
      }
      try {
        controller?.close();
      } catch {
        // Already closed — ignore
      }
      controller = null;
    };

    return { stream, close };
  }
}

/** 应用级单例 */
export const sessionManager = new OpenCodeSessionManager();