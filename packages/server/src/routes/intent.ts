/**
 * /api/projects/:id/intent — 创作意图对齐（AI 交互）
 *
 * POST /  — 发送用户消息，返回 AI 回复 + 结构化意图方案
 *
 * Session 隔离：(x-user-id header, projectId) 独占一个 OpenCode session
 * userId 目前取 x-user-id header，后续接 JWT 时替换为 token subject
 */

import { Hono } from "hono";
import { sessionManager } from "../opencode/manager.js";
import { createLogger } from "@moran/core/logger";

const log = createLogger("intent-route");

// ── 类型定义 ──────────────────────────────────────────────────

export interface IntentScheme {
  id: string;
  label: string;
  核心冲突: string;
  故事卖点: string[];
  基调: string;
  目标读者感受: string;
}

interface IntentResponse {
  reply: string;
  schemes: IntentScheme[] | null;
}

// ── 系统提示 ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `你是灵犀，墨染AI写作工具的创作意图对齐专家。
你的职责是帮助作者把模糊的创作灵感转化为清晰的、结构化的创作意图方案。

当用户描述创作想法时：
1. 先用1-2句话温暖地回应，表达你的理解
2. 然后生成1-3个不同风格/方向的方案供作者选择，每个方案要有差异化定位

必须在回应末尾附上以下格式（用 ---SCHEMES--- 分隔）：
---SCHEMES---
{"schemes":[{"id":"1","label":"方案一名称","核心冲突":"...","故事卖点":["...","..."],"基调":"...","目标读者感受":"..."},{"id":"2","label":"方案二名称","核心冲突":"...","故事卖点":["...","..."],"基调":"...","目标读者感受":"..."}]}

方案名称要富有感染力，如「记忆碎片线」、「身份觉醒路」等。
注意：JSON 必须合法，字符串中不能包含换行符。`;

// ── 工具函数 ──────────────────────────────────────────────────

function extractSchemes(text: string): IntentResponse {
  const separator = "---SCHEMES---";
  const idx = text.indexOf(separator);

  if (idx === -1) {
    return { reply: text.trim(), schemes: null };
  }

  const reply = text.slice(0, idx).trim();
  const jsonPart = text.slice(idx + separator.length).trim();

  try {
    const jsonMatch = jsonPart.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { reply, schemes: null };

    const parsed = JSON.parse(jsonMatch[0]) as { schemes: IntentScheme[] };
    if (Array.isArray(parsed.schemes) && parsed.schemes.length > 0) {
      return { reply, schemes: parsed.schemes };
    }
  } catch {
    // JSON parse 失败，只返回文字回复
  }

  return { reply, schemes: null };
}

// ── 路由 ──────────────────────────────────────────────────────

export function createIntentRoute() {
  const route = new Hono();

  route.post("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    // userId：暂用 header，后续替换为 JWT subject
    const userId = c.req.header("x-user-id") ?? "anonymous";

    let userMessage: string;
    try {
      const body = await c.req.json<{ message?: string }>();
      userMessage = body.message?.trim() ?? "";
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }

    if (!userMessage) {
      return c.json({ error: "message is required" }, 400);
    }

    try {
      let isNewSession = false;

      const sessionId = await sessionManager.getOrCreateSession(
        userId,
        projectId,
        async (_client, _sid) => {
          // 标记：这是新 session，第一条消息要带系统提示
          isNewSession = true;
        },
      );

      // 新 session：第一条消息注入系统提示
      const messageText = isNewSession
        ? `${SYSTEM_PROMPT}\n\n---\n用户的创作想法：${userMessage}`
        : userMessage;

      const client = sessionManager.createClient();
      const promptRes = await client.session.prompt({
        path: { id: sessionId },
        body: {
          parts: [{ type: "text", text: messageText }],
        },
      });

      type Part = { type: string; text?: string };
      const rawText = (promptRes.data?.parts ?? [])
        .filter((p: Part) => p.type === "text")
        .map((p: Part) => p.text ?? "")
        .join("");

      if (!rawText) {
        return c.json({
          reply: "我遇到了一点问题，请再描述一次你的创作想法。",
          schemes: null,
        } satisfies IntentResponse);
      }

      return c.json(extractSchemes(rawText));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ err, projectId, userId }, "Intent API error");
      return c.json({ error: msg }, 500);
    }
  });

  return route;
}