/**
 * Hono 应用定义 — 路由、中间件、错误处理
 *
 * 独立于 HTTP 监听器，方便测试。
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { healthRoute } from "./routes/health.js";
import { errorHandler } from "./middleware/error-handler.js";

const app = new Hono();

// ── 全局中间件 ──────────────────────────────────────────
app.use("*", requestId());
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  }),
);

// ── 路由挂载 ────────────────────────────────────────────
app.route("/", healthRoute);

// TODO: M1.2+ 挂载业务路由
// app.route("/api/projects", projectsRoute);

// ── 全局错误处理 ────────────────────────────────────────
app.onError(errorHandler);

// ── 404 ─────────────────────────────────────────────────
app.notFound((c) => {
  return c.json({ error: "Not Found", path: c.req.path }, 404);
});

export { app };
