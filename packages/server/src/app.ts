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
import {
  EventBus,
  SessionProjectBridge,
  Orchestrator,
  ChapterPipeline,
  StyleManager,
  ReviewEngine,
  JiangxinEngine,
  DianjingEngine,
  ShuchongEngine,
  XidianEngine,
} from "@moran/core";
import { healthRoute } from "./routes/health.js";
import { createEventsRoute } from "./routes/events.js";
import { createWritingRoute } from "./routes/writing.js";
import { createProjectsRoute } from "./routes/projects.js";
import { createChaptersRoute } from "./routes/chapters.js";
import { createReviewsRoute } from "./routes/reviews.js";
import { createStatsRoute } from "./routes/stats.js";
import { createAnalysisRoute } from "./routes/analysis.js";
import { createWorldRoute } from "./routes/world.js";
import { createCharactersRoute } from "./routes/characters.js";
import { createOutlineRoute } from "./routes/outline.js";
import { createStylesRoute } from "./routes/styles.js";
import { createLocationsRoute } from "./routes/locations.js";
import { createTimelineRoute } from "./routes/timeline.js";
import { createVersionsRoute } from "./routes/versions.js";
import { createReaderReviewRoute } from "./routes/reader-review.js";
import { createDiagnosisRoute } from "./routes/diagnosis.js";
import { createExportRoute } from "./routes/export.js";
import { createIntentRoute } from "./routes/intent.js";
import { OpenCodeTransport } from "./opencode/bridge-transport.js";
import { sessionManager } from "./opencode/manager.js";
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
  /** Bridge 实例（不传则自动创建带 OpenCodeTransport 的实例） */
  bridge?: SessionProjectBridge;
  /** CORS 来源 */
  corsOrigin?: string;
}

/**
 * 创建 Hono 应用（依赖注入）
 */
export function createApp(config: AppConfig = {}) {
  const app = new Hono();
  const eventBus = config.eventBus ?? new EventBus();

  // ── Bridge（带 OpenCode Transport 的真实实现） ─────────
  const transport = new OpenCodeTransport(sessionManager);
  const bridge = config.bridge ?? new SessionProjectBridge({}, transport);

  // ── 引擎单例（无状态，可共享） ──────────────────────────
  const styleManager = new StyleManager();
  const reviewEngine = new ReviewEngine();
  const jiangxinEngine = new JiangxinEngine();
  const dianjingEngine = new DianjingEngine();
  const shuchongEngine = new ShuchongEngine();
  const xidianEngine = new XidianEngine();

  // ── Orchestrator 工厂（per-project 状态机） ─────────────
  const orchestrators = new Map<string, Orchestrator>();
  const getOrchestrator: OrchestratorProvider =
    config.getOrchestrator ?? ((projectId: string) => {
      if (!orchestrators.has(projectId)) {
        orchestrators.set(
          projectId,
          new Orchestrator(projectId, { heartbeatInterval: 60_000 }, eventBus),
        );
      }
      return orchestrators.get(projectId);
    });

  // ── ChapterPipeline 工厂（per-project 管线） ───────────
  const getPipeline: PipelineProvider =
    config.getPipeline ?? ((projectId: string) => {
      const orchestrator = getOrchestrator(projectId);
      if (!orchestrator) return undefined;
      return new ChapterPipeline(orchestrator, styleManager, bridge, reviewEngine);
    });

  // ── 全局中间件 ──────────────────────────────────────────
  app.use("*", requestId());
  // CORS: 正常流量走 Next.js rewrite（同源，不触发 CORS），
  // 此处保留作为安全网——直接访问 Hono、Postman 调试、外部服务等场景仍需要。
  app.use(
    "*",
    cors({
      origin: config.corsOrigin
        ?? process.env.CORS_ORIGIN
        ?? ["http://localhost:3000", "http://127.0.0.1:3000"],
      credentials: true,
    }),
  );

  // ── 路由挂载 ────────────────────────────────────────────
  app.route("/", healthRoute);
  app.route("/api/projects", createProjectsRoute());
  app.route("/api/projects/:id/chapters", createChaptersRoute());
  app.route("/api/projects/:id/events", createEventsRoute(eventBus));
  app.route("/api/projects/:id/reviews", createReviewsRoute(bridge, reviewEngine));
  app.route("/api/projects/:id/stats", createStatsRoute());
  app.route("/api/projects/:id/analysis", createAnalysisRoute(bridge, xidianEngine));
  app.route("/api/projects/:id/world", createWorldRoute(bridge, jiangxinEngine));
  app.route("/api/projects/:id/characters", createCharactersRoute(bridge, jiangxinEngine));
  app.route("/api/projects/:id/outline", createOutlineRoute(bridge, jiangxinEngine));
  app.route("/api/projects/:id/styles", createStylesRoute(bridge, styleManager));
  app.route("/api/projects/:id/locations", createLocationsRoute());
  app.route("/api/projects/:id/timeline", createTimelineRoute());
  app.route("/api/projects/:id/versions", createVersionsRoute());
  app.route("/api/projects/:id/reader-review", createReaderReviewRoute(bridge, shuchongEngine));
  app.route("/api/projects/:id/diagnosis", createDiagnosisRoute(bridge, dianjingEngine));
  app.route("/api/projects/:id/export", createExportRoute());
  app.route("/api/projects/:id/writing", createWritingRoute(getOrchestrator, getPipeline, bridge));
  app.route("/api/projects/:id/intent", createIntentRoute());

  // ── 全局错误处理 ────────────────────────────────────────
  app.onError(errorHandler);

  // ── 404 ─────────────────────────────────────────────────
  app.notFound((c) => {
    return c.json({ error: "Not Found", path: c.req.path }, 404);
  });

  return { app, eventBus, bridge };
}
