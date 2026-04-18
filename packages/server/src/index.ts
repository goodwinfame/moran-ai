/**
 * 服务端入口 — 启动 Hono HTTP 服务器
 */
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { sessionManager } from "./opencode/manager.js";
import { createLogger } from "@moran/core/logger";

const log = createLogger("server");

const port = Number(process.env.PORT ?? 3200);

const { app } = createApp();

// 启动前检查 opencode serve 是否可达
await sessionManager.checkHealth();

// 启动 session 过期清理
sessionManager.startCleanup();

serve({ fetch: app.fetch, port }, (info) => {
  log.info({ port: info.port }, "墨染 API 服务已启动");
});

// 进程退出时清理
process.on("SIGTERM", () => {
  sessionManager.stopCleanup();
  process.exit(0);
});
process.on("SIGINT", () => {
  sessionManager.stopCleanup();
  process.exit(0);
});