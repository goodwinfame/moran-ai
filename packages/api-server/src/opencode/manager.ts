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
import type { OpencodeClient } from "@opencode-ai/sdk";
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

export class OpenCodeSessionManager {
  private readonly baseUrl: string;
  private readonly ttlMs: number;
  private readonly sessions = new Map<string, ManagedSession>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

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
      if (now - s.lastActiveAt > this.ttlMs) {
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
}

/** 应用级单例 */
export const sessionManager = new OpenCodeSessionManager();