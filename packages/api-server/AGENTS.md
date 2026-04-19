# AGENTS.md — packages/api-server

> Hono 后端包。所有业务 API 在这里，不在 Next.js。

---

## V2 包职责

- 所有 `/api/projects/:id/*` RESTful 路由（待按 SDD Spec 实现）
- OpenCode Session 管理（`src/opencode/manager.ts`）
- SSE 事件推送（待实现）
- 全局中间件与错误处理

## 关键文件

| 文件 | 说明 |
|------|------|
| `src/app.ts` | `createApp()` — Hono 应用骨架，路由挂载入口 |
| `src/index.ts` | HTTP 监听器入口 |
| `src/routes/auth.ts` | Auth 路由（register/login/logout，公开） |
| `src/middleware/auth.ts` | `requireAuth` 中间件（Cookie + Session 校验） |
| `src/middleware/error-handler.ts` | 全局错误处理 |
| `src/opencode/manager.ts` | OpenCodeSessionManager 单例 |

## V2 变更

V1 的路由、导出功能、Bridge 传输层已全部删除。
V2 路由将按 SDD Spec 分批添加。

## 路由约定（V2）

- 每个路由文件导出 `createXxxRoutes()` 工厂函数
- 在 `app.ts` 中挂载到 `/api/xxx`
- 路由内通过 `c.req.param("id")` 取 projectId
- userId 通过 `c.get("userId")` 取（由 `requireAuth` 中间件注入）
- Auth 路由（`/api/auth/*`）是公开路由，必须在 `requireAuth` 之前注册

## 测试规范

- 使用 `createApp()` + `app.request()` 发请求，不启动真实 HTTP
- 运行：`pnpm --filter @moran/api-server test`

## 禁止事项

- 不能在这里渲染 HTML / 页面
- 不能直接调 LLM Provider，必须通过 OpenCode SDK → opencode serve
- 不能 `as any` / `@ts-ignore`
