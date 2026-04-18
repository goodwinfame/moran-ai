# AGENTS.md — packages/server

> Hono 后端包。所有业务 API 在这里，不在 Next.js。

---

## 包职责

- 所有 `/api/projects/:id/*` RESTful 路由
- OpenCode Session 管理（`src/opencode/manager.ts`）
- AI 意图对齐路由（`src/routes/intent.ts`）
- 写作流程编排（`src/routes/writing.ts` + Orchestrator）

## 关键文件

| 文件 | 说明 |
|------|------|
| `src/app.ts` | `createApp()` — 引擎单例创建、路由挂载、中间件、错误处理 |
| `src/index.ts` | HTTP 监听器，启动 sessionManager.startCleanup() |
| `src/opencode/manager.ts` | OpenCodeSessionManager 单例 |
| `src/opencode/bridge-transport.ts` | `OpenCodeTransport` — BridgeTransport 的 SDK 实现 |
| `src/routes/intent.ts` | POST /api/projects/:id/intent |
| `src/routes/writing.ts` | 写作流程路由 |
| `src/routes/world.ts` | 世界观 CRUD + POST /align（JiangxinEngine） |
| `src/routes/characters.ts` | 角色 CRUD + POST /align（JiangxinEngine） |
| `src/routes/outline.ts` | 大纲 CRUD + POST /align（JiangxinEngine） |
| `src/routes/styles.ts` | 文风 CRUD + POST /align（StyleManager） |
| `src/routes/reviews.ts` | 审校 CRUD + POST（ReviewEngine） |
| `src/routes/diagnosis.ts` | 诊断 CRUD + POST（DianjingEngine） |
| `src/routes/reader-review.ts` | 读者评审 CRUD + POST（ShuchongEngine） |
| `src/routes/analysis.ts` | 分析 CRUD + POST 异步 202（XidianEngine） |
| `src/middleware/error-handler.ts` | 全局错误处理 |

## OpenCode SessionManager

```typescript
import { sessionManager } from "./opencode/manager.js";

// 获取或创建 session（第一次调用触发 onNew 回调）
const sessionId = await sessionManager.getOrCreateSession(userId, projectId, async (client, sid) => {
  // onNew：新 session 初始化（注入系统提示等）
});

// 创建无状态 SDK client
const client = sessionManager.createClient();
```

- key = `${userId}:${projectId}`
- baseUrl 默认 `http://127.0.0.1:4096`，可通过 `OPENCODE_BASE_URL` 覆盖
- TTL 30 分钟，每 5 分钟扫描一次过期

## 路由约定

- 每个路由文件导出 `createXxxRoute()` 工厂函数，参数为所需的 Bridge + Engine
- 在 `app.ts` 中挂载到 `/api/projects/:id/xxx`
- 路由内通过 `c.req.param("id")` 取 projectId
- userId 通过 `c.req.header("x-user-id")` 取（fallback `"anonymous"`）

### 路由工厂签名

```typescript
// 筹备对齐（4 个端点）
createWorldRoute(bridge: SessionProjectBridge, jiangxinEngine: JiangxinEngine)
createCharactersRoute(bridge: SessionProjectBridge, jiangxinEngine: JiangxinEngine)
createOutlineRoute(bridge: SessionProjectBridge, jiangxinEngine: JiangxinEngine)
createStylesRoute(bridge: SessionProjectBridge, styleManager: StyleManager)

// AI POST 端点（4 个端点）
createReviewsRoute(bridge: SessionProjectBridge, reviewEngine: ReviewEngine)
createDiagnosisRoute(bridge: SessionProjectBridge, dianjingEngine: DianjingEngine)
createReaderReviewRoute(bridge: SessionProjectBridge, shuchongEngine: ShuchongEngine)
createAnalysisRoute(bridge: SessionProjectBridge, xidianEngine: XidianEngine)

// 其他（无 Bridge/Engine 依赖）
createIntentRoute()
createWritingRoute(getOrchestrator, getPipeline?, bridge?)
createStatsRoute()
createExportRoute()
createSettingsRoute()
createVersionsRoute()
createVisualizeRoute()
createChaptersRoute()
```

### app.ts 引擎创建模式

```typescript
// app.ts 中创建单例，注入到路由
const bridge = new SessionProjectBridge({}, transport);
const jiangxinEngine = new JiangxinEngine();
const reviewEngine = new ReviewEngine();
const dianjingEngine = new DianjingEngine();
const shuchongEngine = new ShuchongEngine();
const xidianEngine = new XidianEngine();
const styleManager = new StyleManager();
```

## 测试规范

- 使用 `createApp()` + `app.request()` 发请求，不启动真实 HTTP
- Mock `@opencode-ai/sdk`：`vi.mock("@opencode-ai/sdk", () => ({ createOpencodeClient: vi.fn(...) }))`
- `sessionManager` 是单例，测试间需 `mgr.sessions.clear()` 重置
- 运行：`pnpm --filter @moran/server test`

## 禁止事项

- 不能在这里渲染 HTML / 页面
- 不能直接调 LLM Provider，必须通过 OpenCode SDK → opencode serve
- 不能 `as any` / `@ts-ignore`
