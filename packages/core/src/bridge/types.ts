/**
 * Bridge 类型定义 — Session-Project 桥接层
 *
 * OpenCode 的 Session 语义是"对话"，小说是"项目"。
 * Bridge 层将两者关联，所有项目数据在 PostgreSQL，
 * OpenCode Session ID 仅作为执行上下文的引用。
 */

import type { AgentId } from "../agents/types.js";

/** Session 状态 */
export type SessionStatus = "active" | "completed" | "error" | "paused";

/** Session-Project 关联记录 */
export interface SessionBinding {
  /** OpenCode Session ID */
  sessionId: string;
  /** 项目 ID */
  projectId: string;
  /** 当前执行的 Agent */
  activeAgent?: AgentId;
  /** Session 状态 */
  status: SessionStatus;
  /** 关联的章节号（如果在写作阶段） */
  chapterNumber?: number;
  /** 创建时间 */
  createdAt: Date;
  /** 最后活跃时间 */
  lastActiveAt: Date;
}

/** Agent 调用参数 */
export interface AgentInvocation {
  /** Agent ID */
  agentId: AgentId;
  /** Session ID (复用或新建) */
  sessionId?: string;
  /** 输入消息 */
  message: string;
  /** System prompt 覆盖（部分 agent 需要专用 system prompt） */
  systemPrompt?: string;
  /** 是否使用流式输出 */
  stream?: boolean;
  /** 温度覆盖 */
  temperature?: number;
  /** 额外上下文 */
  context?: string;
}

/** Agent 调用结果 */
export interface AgentResponse {
  /** 输出文本 */
  content: string;
  /** Session ID */
  sessionId: string;
  /** 使用的 token 数 */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Agent ID */
  agentId: AgentId;
}

/**
 * BridgeTransport — 传输层抽象
 *
 * Core 包定义接口，Server 包提供基于 OpenCode SDK 的实现。
 * 这样 Core 无需依赖 `@opencode-ai/sdk`。
 */
export interface BridgeTransport {
  /** 创建 OpenCode Session，返回 sessionId */
  createSession(title: string): Promise<string>;
  /** 发送消息到 Session，返回完整响应 */
  prompt(
    sessionId: string,
    message: string,
  ): Promise<BridgeTransportResponse>;
}

/** Transport 层的响应结构 */
export interface BridgeTransportResponse {
  /** LLM 输出文本 */
  content: string;
  /** Token 使用量 */
  usage: { inputTokens: number; outputTokens: number };
}

/** Bridge 配置 */
export interface BridgeConfig {
  /** 是否自动创建 Session */
  autoCreateSession: boolean;
  /** Session 超时时间（毫秒） */
  sessionTimeout: number;
}

export const DEFAULT_BRIDGE_CONFIG: BridgeConfig = {
  autoCreateSession: true,
  sessionTimeout: 3600_000, // 1 hour
};
