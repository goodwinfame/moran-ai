/**
 * Hono 应用定义 — V2
 *
 * 路由挂载顺序：
 * 1. 全局中间件（requestId, cors）
 * 2. 健康检查（公开）
 * 3. Auth 路由（公开，不需认证）
 * 4. requireAuth 中间件（保护后续所有 /api/* 路由）
 * 5. 业务路由（需认证）
 * 6. 全局错误处理 + 404
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { errorHandler } from "./middleware/error-handler.js";
import { requireAuth } from "./middleware/auth.js";
import { createAuthRoutes } from "./routes/auth.js";
import { createProjectRoutes } from "./routes/projects.js";
import { createChatRoutes } from "./routes/chat.js";
import { createUserRoutes } from "./routes/user.js";
import { createPanelRoutes } from "./routes/panel/index.js";
import { createUsageRoutes } from "./routes/usage.js";
import { createLogRoutes } from "./routes/logs.js";

/** Hono Variables injected by middleware */
type AppVariables = {
  userId: string;
};

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
  const app = new Hono<{ Variables: AppVariables }>();

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

  // ── 健康检查（公开） ────────────────────────────────────
  app.get("/health", (c) => c.json({ status: "ok", version: "2.0.0" }));

  // ── Auth 路由（公开，必须在 requireAuth 之前） ──────────
  app.route("/api/auth", createAuthRoutes());

  // ── 认证中间件（保护后续所有 /api/* 路由） ──────────────
  app.use("/api/*", requireAuth);

  // ── 业务路由（需认证） ───────────────────────────────────
  app.route("/api/chat", createChatRoutes());
  app.route("/api/projects", createProjectRoutes());
  app.route("/api/projects/:id", createPanelRoutes());
  app.route("/api/projects/:id/usage", createUsageRoutes());
  app.route("/api/projects/:id/logs", createLogRoutes());
  app.route("/api/user", createUserRoutes());

  // ── 全局错误处理 ────────────────────────────────────────
  app.onError(errorHandler);

  // ── 404 ─────────────────────────────────────────────────
  app.notFound((c) => {
    return c.json({ error: "Not Found", path: c.req.path }, 404);
  });

  return { app };
}
