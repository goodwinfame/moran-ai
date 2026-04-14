/**
 * SessionProjectBridge — OpenCode Session 与 MoRan Project 的桥接层
 *
 * 职责：
 * 1. 管理 Session 与 Project 的绑定关系
 * 2. 创建/复用 OpenCode Session
 * 3. 通过 Session 调用指定 Agent
 * 4. 追踪 Session 生命周期
 *
 * 注意：本模块在 M1.3 阶段实现框架和接口，
 * 实际的 OpenCode SDK 调用在 M1.4 阶段集成。
 * 当前使用 placeholder 实现，标记为 TODO。
 */

import type { AgentId } from "../agents/types.js";
import { defaultRegistry } from "../agents/registry.js";
import { createLogger } from "../logger/index.js";
import type {
  AgentInvocation,
  AgentResponse,
  BridgeConfig,
  SessionBinding,
} from "./types.js";
import { DEFAULT_BRIDGE_CONFIG } from "./types.js";

export class SessionProjectBridge {
  private bindings: Map<string, SessionBinding> = new Map();
  private readonly config: BridgeConfig;
  private readonly logger = createLogger("bridge");

  constructor(config?: Partial<BridgeConfig>) {
    this.config = { ...DEFAULT_BRIDGE_CONFIG, ...config };
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

    // TODO: M1.4 — 调用 OpenCode SDK 创建 Session
    // const session = await client.session.create({ body: { title: `MoRan Project ${projectId}` } });
    const sessionId = `moran-session-${projectId}-${Date.now()}`;
    this.logger.info({ projectId, sessionId }, "Created new session (placeholder)");

    return this.bind(sessionId, projectId);
  }

  /**
   * 调用 Agent
   *
   * 在 M1.3 阶段返回 placeholder 响应。
   * M1.4 会集成 OpenCode SDK 的 session.prompt() 调用。
   */
  async invokeAgent(invocation: AgentInvocation): Promise<AgentResponse> {
    const agent = defaultRegistry.get(invocation.agentId);
    if (!agent) {
      throw new Error(`Agent "${invocation.agentId}" not found in registry`);
    }

    this.logger.info(
      { agentId: invocation.agentId, stream: invocation.stream ?? false },
      "Invoking agent (placeholder)",
    );

    // TODO: M1.4 — 实际调用 OpenCode SDK
    // const response = await client.session.prompt({
    //   sessionId: invocation.sessionId,
    //   body: {
    //     message: invocation.message,
    //     agent: invocation.agentId,
    //     stream: invocation.stream,
    //   },
    // });

    return {
      content: `[Placeholder] Agent ${agent.name} (${agent.id}) response to: ${invocation.message.slice(0, 50)}...`,
      sessionId: invocation.sessionId ?? `placeholder-session-${Date.now()}`,
      usage: { inputTokens: 0, outputTokens: 0 },
      agentId: invocation.agentId,
    };
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
