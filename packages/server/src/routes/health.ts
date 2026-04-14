/**
 * /health — 健康检查端点
 */
import { Hono } from "hono";

export const healthRoute = new Hono();

healthRoute.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "moran-server",
    timestamp: new Date().toISOString(),
  });
});
