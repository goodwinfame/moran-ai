/**
 * 服务端入口 — 启动 Hono HTTP 服务器
 *
 * V2: 简化启动，OpenCode 健康检查在路由就绪后按需启用。
 */
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createLogger } from "@moran/core/logger";

const log = createLogger("server");

const port = Number(process.env.PORT ?? 3200);

const { app } = createApp();

serve({ fetch: app.fetch, port }, (info) => {
  log.info({ port: info.port }, "墨染 API 服务已启动 (V2)");
});

// 进程退出时清理
process.on("SIGTERM", () => {
  process.exit(0);
});
process.on("SIGINT", () => {
  process.exit(0);
});
