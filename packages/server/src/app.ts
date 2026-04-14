/**
 * Hono 应用定义 — 路由、中间件、错误处理
 *
 * 独立于 HTTP 监听器，方便测试。
 * 依赖注入模式：createApp() 接收共享实例（EventBus, OrchestratorProvider, PipelineProvider），
 * 避免全局单例，便于测试和多项目支持。
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { EventBus } from "@moran/core";
import { healthRoute } from "./routes/health.js";
import { createEventsRoute } from "./routes/events.js";
import { createWritingRoute } from "./routes/writing.js";
import { createProjectsRoute } from "./routes/projects.js";
import { createChaptersRoute } from "./routes/chapters.js";
import { createReviewsRoute } from "./routes/reviews.js";
import { createStatsRoute } from "./routes/stats.js";
import type { OrchestratorProvider, PipelineProvider } from "./routes/writing.js";
import { errorHandler } from "./middleware/error-handler.js";

/**
 * 应用配置
 */
export interface AppConfig {
  /** 共享的 EventBus 实例 */
  eventBus?: EventBus;
  /** Orchestrator 提供器 — 按 projectId 获取实例 */
  getOrchestrator?: OrchestratorProvider;
  /** ChapterPipeline 提供器 — 按 projectId 获取实例（M1.4+） */
  getPipeline?: PipelineProvider;
  /** CORS 来源 */
  corsOrigin?: string;
}

/**
 * 创建 Hono 应用（依赖注入）
 */
export function createApp(config: AppConfig = {}) {
  const app = new Hono();
  const eventBus = config.eventBus ?? new EventBus();
  const getOrchestrator: OrchestratorProvider =
    config.getOrchestrator ?? (() => undefined);

  // ── 全局中间件 ──────────────────────────────────────────
  app.use("*", requestId());
  app.use(
    "*",
    cors({
      origin: config.corsOrigin ?? process.env.CORS_ORIGIN ?? "http://localhost:3000",
      credentials: true,
    }),
  );

  // ── 路由挂载 ────────────────────────────────────────────
  app.route("/", healthRoute);
  app.route("/api/projects", createProjectsRoute());
  app.route("/api/projects/:id/chapters", createChaptersRoute());
  app.route("/api/projects/:id/events", createEventsRoute(eventBus));
  app.route("/api/projects/:id/reviews", createReviewsRoute());
  app.route("/api/projects/:id/stats", createStatsRoute());
  app.route("/api/projects/:id/writing", createWritingRoute(getOrchestrator, config.getPipeline));

  // ── 全局错误处理 ────────────────────────────────────────
  app.onError(errorHandler);

  // ── 404 ─────────────────────────────────────────────────
  app.notFound((c) => {
    return c.json({ error: "Not Found", path: c.req.path }, 404);
  });

  return { app, eventBus };
}
