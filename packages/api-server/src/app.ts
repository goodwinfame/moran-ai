/**
 * Hono 应用定义 — V2 最小骨架
 *
 * V2 路由将在 SDD Spec 完成后分批添加。
 * 保留依赖注入模式，便于测试。
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { errorHandler } from "./middleware/error-handler.js";

/**
 * 应用配置
 */
export interface AppConfig {
  /** CORS 来源 */
  corsOrigin?: string;
}

/**
 * 创建 Hono 应用（依赖注入）
 */
export function createApp(config: AppConfig = {}) {
  const app = new Hono();

  // ── 全局中间件 ──────────────────────────────────────────
  app.use("*", requestId());
  app.use(
    "*",
    cors({
      origin: config.corsOrigin
        ?? process.env.CORS_ORIGIN
        ?? ["http://localhost:3000", "http://127.0.0.1:3000"],
      credentials: true,
    }),
  );

  // ── 健康检查 ────────────────────────────────────────────
  app.get("/health", (c) => c.json({ status: "ok", version: "2.0.0" }));

  // ── V2 路由将在此处挂载 ─────────────────────────────────
  // TODO: 按 SDD Spec 分批添加路由

  // ── 全局错误处理 ────────────────────────────────────────
  app.onError(errorHandler);

  // ── 404 ─────────────────────────────────────────────────
  app.notFound((c) => {
    return c.json({ error: "Not Found", path: c.req.path }, 404);
  });

  return { app };
}
