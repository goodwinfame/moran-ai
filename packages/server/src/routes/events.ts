/**
 * /api/projects/:id/events — SSE 实时事件流
 *
 * 长连接，推送 8 类命名事件：
 * context, writing, reviewing, review, archiving, done, error, heartbeat
 *
 * M3.6: 支持 Last-Event-ID 断线重连回放。
 * - 每个事件携带递增 `id:` 字段
 * - 客户端重连时通过 `Last-Event-ID` 请求头或 query 参数传入上次收到的 ID
 * - 服务端从 EventBuffer 回放缺失事件
 * - 如果 ID 已被缓冲区淘汰，发送 `reconnect-failed` 事件通知客户端需要全量恢复
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

    // 解析 Last-Event-ID — 优先 header，fallback query param
    const lastEventIdHeader = c.req.header("Last-Event-ID");
    const lastEventIdQuery = c.req.query("lastEventId");
    const lastEventIdStr = lastEventIdHeader ?? lastEventIdQuery;
    const lastEventId = lastEventIdStr ? parseInt(lastEventIdStr, 10) : null;

    const isReconnect = lastEventId !== null && !isNaN(lastEventId);

    log.info(
      { projectId, isReconnect, lastEventId: isReconnect ? lastEventId : undefined },
      "SSE connection opened",
    );

    return streamSSE(
      c,
      async (stream) => {
        // ── 断线重连回放 ──────────────────────────────────────
        if (isReconnect && lastEventId !== null) {
          const missed = eventBus.buffer.getAfter(projectId, lastEventId);

          if (missed === null) {
            // 缓冲区已淘汰 — 通知客户端需要全量恢复
            log.warn(
              { projectId, lastEventId },
              "Last-Event-ID expired, cannot replay",
            );
            await stream.writeSSE({
              event: "reconnect-failed",
              data: JSON.stringify({
                reason: "expired",
                message: "事件缓冲区已过期，请刷新页面获取最新状态",
              }),
            });
          } else if (missed.length > 0) {
            log.info(
              { projectId, replayCount: missed.length, fromId: lastEventId },
              "Replaying missed events",
            );
            // 按顺序回放缺失事件
            for (const buffered of missed) {
              await stream.writeSSE({
                event: buffered.event.type,
                data: JSON.stringify(buffered.event.data),
                id: String(buffered.id),
              });
            }
          }
          // missed.length === 0 时，客户端已是最新，无需回放
        }

        // ── 心跳保活 — 每 30s 发送一次 ──────────────────────
        const heartbeatInterval = setInterval(async () => {
          try {
            // 心跳也通过 EventBus 发送，自动获得 ID 和缓冲
            eventBus.emit(projectId, { type: "heartbeat", data: { ts: Date.now() } });
          } catch {
            clearInterval(heartbeatInterval);
          }
        }, 30_000);

        // ── 订阅项目的 SSE 事件流（带 ID） ──────────────────
        const unsubscribe = eventBus.subscribeWithId(
          projectId,
          (event: SSEEvent, eventId: number) => {
            stream
              .writeSSE({
                event: event.type,
                data: JSON.stringify(event.data),
                id: String(eventId),
              })
              .catch(() => {
                // 写入失败 = 连接已断开，静默忽略
              });
          },
        );

        // ── 发送初始连接确认（带 ID）────────────────────────
        const connectId = eventBus.emit(projectId, {
          type: "heartbeat",
          data: { ts: Date.now() },
        });
        // emit 已经通过 subscribeWithId 发送给了当前连接

        log.debug({ projectId, connectId }, "Initial heartbeat sent");

        // ── 等待客户端断开连接 ──────────────────────────────
        stream.onAbort(() => {
          log.info({ projectId }, "SSE connection closed");
          clearInterval(heartbeatInterval);
          unsubscribe();
        });

        // 保持连接存活 — 循环等待直到 abort
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
