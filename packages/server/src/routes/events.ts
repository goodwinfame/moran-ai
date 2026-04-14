/**
 * /api/projects/:id/events — SSE 实时事件流
 *
 * 长连接，推送 8 类命名事件：
 * context, writing, reviewing, review, archiving, done, error, heartbeat
 *
 * 本模块只负责 SSE 传输层。业务逻辑由 Orchestrator + EventBus 驱动。
 * M1.3 阶段：完整的 SSE 管道框架 + 心跳保活。
 * M1.4+ 阶段：接入真实 Orchestrator 事件。
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { EventBus } from "@moran/core";
import type { SSEEvent } from "@moran/core";
import { createLogger } from "@moran/core/logger";

const log = createLogger("sse-events");

/**
 * 创建 SSE 事件路由
 *
 * @param eventBus - 共享的 EventBus 实例（由 app 层注入）
 */
export function createEventsRoute(eventBus: EventBus) {
  const route = new Hono();

  route.get("/", (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    log.info({ projectId }, "SSE connection opened");

    return streamSSE(
      c,
      async (stream) => {
        // 心跳保活 — 每 30s 发送一次
        const heartbeatInterval = setInterval(async () => {
          try {
            await stream.writeSSE({
              event: "heartbeat",
              data: JSON.stringify({ ts: Date.now() }),
            });
          } catch {
            // 连接已关闭，清理即可
            clearInterval(heartbeatInterval);
          }
        }, 30_000);

        // 订阅项目的 SSE 事件流
        const unsubscribe = eventBus.subscribe(projectId, (event: SSEEvent) => {
          stream
            .writeSSE({
              event: event.type,
              data: JSON.stringify(event.data),
            })
            .catch(() => {
              // 写入失败 = 连接已断开，静默忽略
            });
        });

        // 发送初始连接确认
        await stream.writeSSE({
          event: "heartbeat",
          data: JSON.stringify({ ts: Date.now() }),
        });

        // 等待客户端断开连接
        // stream.onAbort 在 Hono streamSSE 中由底层 AbortSignal 触发
        stream.onAbort(() => {
          log.info({ projectId }, "SSE connection closed");
          clearInterval(heartbeatInterval);
          unsubscribe();
        });

        // 保持连接存活 — 循环等待直到 abort
        // Hono streamSSE 的 callback 结束时流就会关闭，
        // 所以我们用一个 Promise 阻塞直到 abort
        await new Promise<void>((resolve) => {
          stream.onAbort(() => resolve());
        });
      },
      async (err, stream) => {
        log.error({ err }, "SSE stream error");
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            message: "Internal stream error",
            recoverable: false,
          }),
        });
      },
    );
  });

  return route;
}
