/**
 * OpenCodeTransport — BridgeTransport 的 OpenCode SDK 实现
 *
 * 在 server 包中实现，通过依赖注入传给 core 的 SessionProjectBridge。
 * 这样 core 无需依赖 `@opencode-ai/sdk`。
 */

import type { BridgeTransport, BridgeTransportResponse } from "@moran/core";
import type { OpenCodeSessionManager } from "./manager.js";
import { createLogger } from "@moran/core/logger";

const log = createLogger("bridge-transport");

export class OpenCodeTransport implements BridgeTransport {
  constructor(private readonly sessionManager: OpenCodeSessionManager) {}

  async createSession(title: string): Promise<string> {
    const client = this.sessionManager.createClient();
    const res = await client.session.create({
      body: { title },
    });

    const sessionId = res.data?.id;
    if (!sessionId) {
      throw new Error("OpenCode session.create returned no id");
    }

    log.info({ sessionId, title }, "Transport: session created");
    return sessionId;
  }

  async prompt(
    sessionId: string,
    message: string,
  ): Promise<BridgeTransportResponse> {
    const client = this.sessionManager.createClient();
    const res = await client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: "text", text: message }],
      },
    });

    // 从响应中提取文本（与 intent.ts 相同的解析逻辑）
    type Part = { type: string; text?: string };
    const parts = (res.data?.parts ?? []) as Part[];
    const content = parts
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("");

    if (!content) {
      log.warn({ sessionId }, "Transport: empty response from OpenCode");
    }

    return {
      content,
      // OpenCode SDK 目前不暴露 token usage，返回 0
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}
