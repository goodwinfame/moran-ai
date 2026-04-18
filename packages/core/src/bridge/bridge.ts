/**
 * SessionProjectBridge — OpenCode Session 与 MoRan Project 的桥接层
 *
 * 职责：
 * 1. 管理 Session 与 Project 的绑定关系
 * 2. 创建/复用 OpenCode Session
 * 3. 通过 Session 调用指定 Agent
 * 4. 追踪 Session 生命周期
 *
 * 传输层采用依赖注入：构造时传入 BridgeTransport 则走真实 SDK，
 * 不传则回退到 placeholder 模式（兼容测试）。
 */

import type { AgentId } from "../agents/types.js";
import { defaultRegistry } from "../agents/registry.js";
import { createLogger } from "../logger/index.js";
import type {
  AgentInvocation,
  AgentResponse,
  BridgeConfig,
  BridgeTransport,
  SessionBinding,
} from "./types.js";
import { DEFAULT_BRIDGE_CONFIG } from "./types.js";

export class SessionProjectBridge {
  private bindings: Map<string, SessionBinding> = new Map();
  private readonly config: BridgeConfig;
  private readonly transport: BridgeTransport | null;
  private readonly logger = createLogger("bridge");

  constructor(config?: Partial<BridgeConfig>, transport?: BridgeTransport) {
    this.config = { ...DEFAULT_BRIDGE_CONFIG, ...config };
    this.transport = transport ?? null;
  }

  /** 是否有真实传输层（非 placeholder 模式） */
  hasTransport(): boolean {
    return this.transport !== null;
  }

  /** 获取当前配置 */
  getConfig(): Readonly<BridgeConfig> {
    return this.config;
  }

  /**
   * 绑定 Session 到 Project
   */
  bind(sessionId: string, projectId: string): SessionBinding {
    const binding: SessionBinding = {
      sessionId,
      projectId,
      status: "active",
      createdAt: new Date(),
      lastActiveAt: new Date(),
    };
    this.bindings.set(projectId, binding);
    this.logger.info({ sessionId, projectId }, "Session bound to project");
    return binding;
  }

  /**
   * 获取项目的当前 Session 绑定
   */
  getBinding(projectId: string): SessionBinding | undefined {
    return this.bindings.get(projectId);
  }

  /**
   * 确保项目有活跃的 Session
   * 如果没有则创建新的
   */
  async ensureSession(projectId: string): Promise<SessionBinding> {
    const existing = this.bindings.get(projectId);
    if (existing && existing.status === "active") {
      return existing;
    }

    let sessionId: string;
    if (this.transport) {
      sessionId = await this.transport.createSession(`MoRan Project ${projectId}`);
      this.logger.info({ projectId, sessionId }, "Created new session via transport");
    } else {
      // Placeholder 模式（无 transport，用于测试或 M1.3 兼容）
      sessionId = `moran-session-${projectId}-${Date.now()}`;
      this.logger.info({ projectId, sessionId }, "Created new session (placeholder)");
    }

    return this.bind(sessionId, projectId);
  }

  /**
   * 调用 Agent
   *
   * 有 transport → 真实调用 OpenCode SDK（需先 ensureSession 或提供 sessionId）
   * 无 transport → placeholder 响应（测试兼容）
   */
  async invokeAgent(invocation: AgentInvocation): Promise<AgentResponse> {
    const agent = defaultRegistry.get(invocation.agentId);
    if (!agent) {
      throw new Error(`Agent "${invocation.agentId}" not found in registry`);
    }

    if (this.transport) {
      // ── 真实调用模式 ──
      const sessionId = invocation.sessionId ?? this.findActiveSessionId();
      if (!sessionId) {
        throw new Error(
          "No active session found. Call ensureSession(projectId) before invokeAgent(), " +
          "or provide sessionId in the invocation.",
        );
      }

      // 拼接 system prompt（匹配引擎调用模式）
      const fullMessage = invocation.systemPrompt
        ? `${invocation.systemPrompt}\n\n---\n\n${invocation.message}`
        : invocation.message;

      this.logger.info(
        { agentId: invocation.agentId, sessionId, stream: invocation.stream ?? false },
        "Invoking agent via transport",
      );

      const result = await this.transport.prompt(sessionId, fullMessage);

      return {
        content: result.content,
        sessionId,
        usage: result.usage,
        agentId: invocation.agentId,
      };
    }

    // ── Placeholder 模式（无 transport，兼容测试） ──
    this.logger.info(
      { agentId: invocation.agentId, stream: invocation.stream ?? false },
      "Invoking agent (placeholder)",
    );

    return {
      content: `[Placeholder] Agent ${agent.name} (${agent.id}) response to: ${invocation.message.slice(0, 50)}...`,
      sessionId: invocation.sessionId ?? `placeholder-session-${Date.now()}`,
      usage: { inputTokens: 0, outputTokens: 0 },
      agentId: invocation.agentId,
    };
  }

  /**
   * 查找当前活跃的 sessionId
   * 用于 invokeAgent 未提供 sessionId 时的回退
   */
  private findActiveSessionId(): string | undefined {
    for (const binding of this.bindings.values()) {
      if (binding.status === "active") {
        return binding.sessionId;
      }
    }
    return undefined;
  }

  /**
   * 更新 Session 绑定中的活跃 Agent
   */
  setActiveAgent(projectId: string, agentId: AgentId): void {
    const binding = this.bindings.get(projectId);
    if (binding) {
      binding.activeAgent = agentId;
      binding.lastActiveAt = new Date();
    }
  }

  /**
   * 标记 Session 完成
   */
  complete(projectId: string): void {
    const binding = this.bindings.get(projectId);
    if (binding) {
      binding.status = "completed";
      binding.lastActiveAt = new Date();
    }
  }

  /**
   * 释放 Session 绑定
   */
  release(projectId: string): void {
    this.bindings.delete(projectId);
    this.logger.info({ projectId }, "Session released");
  }

  /**
   * 清理所有绑定
   */
  dispose(): void {
    this.bindings.clear();
  }
}
