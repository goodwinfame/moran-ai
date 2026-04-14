/**
 * 服务端入口 — 启动 Hono HTTP 服务器
 */
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { createLogger } from "@moran/core/logger";

const log = createLogger("server");

const port = Number(process.env.PORT ?? 3200);

serve({ fetch: app.fetch, port }, (info) => {
  log.info({ port: info.port }, "墨染 API 服务已启动");
});
