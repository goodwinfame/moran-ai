# AGENTS.md — 墨染 AI 写作工具

> 本文件供 AI Agent 读取，描述项目整体架构、服务链路、约定和禁止事项。
> 修改前请先阅读整个文件。

---

## 文档维护规则（AGENTS 必读）

**每次代码改动完成后，必须检查以下内容是否需要同步更新 AGENTS.md：**

| 改动类型 | 需要更新的文档 |
|----------|---------------|
| 新增/删除路由 | `packages/server/AGENTS.md` — 关键文件表、路由约定 |
| 修改服务架构（端口、新服务） | 根目录 `AGENTS.md` — 服务架构图 |
| 修改 SessionManager 接口/行为 | `packages/server/AGENTS.md` — OpenCode SessionManager 章节 |
| 修改前端调用方式 | `packages/web/AGENTS.md`、根目录 `AGENTS.md` |
| 修改职责边界（谁做什么） | 根目录 `AGENTS.md` — 职责边界章节 |
| Bridge 集成进展（M1.4） | `packages/core/AGENTS.md` — Bridge 状态章节 |
| 里程碑完成/新增 | 根目录 `AGENTS.md` — 里程碑状态表 |
| 新增包或删除包 | 根目录 `AGENTS.md` — Monorepo 结构 |

**判断标准**：文档中的描述与代码实际行为不符时，必须更新。不确定时，更新。

**更新时机**：代码改动完成、测试通过后，作为最后一步执行，不需要用户提醒。

---

## 项目概览

**墨染（MoRan）** 是一款 AI 辅助网文创作工具，帮助作者从灵感到完稿。

### 服务架构

```
用户浏览器
  └── Next.js (web, :3000)          页面渲染 / 静态资源 / Auth cookie 中间件
        └── Hono (server, :3200)    所有业务 API
              └── OpenCode serve (:4096)  AI 对话引擎
                    └── LLM Provider (云端)
```

### Monorepo 结构

```
packages/
  web/      Next.js 前端（页面 + 组件 + Zustand store）
  server/   Hono 后端（业务 API + OpenCode 集成）
  core/     共享库（Orchestrator, EventBus, Bridge 框架, Agent 类型）
  agents/   Agent prompt 和配置（M1.4+）
```

---

## 职责边界（CRITICAL）

### Next.js (packages/web) 只做三件事

1. 页面渲染（Server Components / Client Components）
2. 静态资源
3. Auth session cookie 校验中间件（`middleware.ts`）

**禁止**在 Next.js 里写任何业务逻辑 API。Route Handler 只在极少数情况下存在（tombstone 410 响应）。

### Hono (packages/server) 做所有业务

- RESTful API：`/api/projects/:id/*`
- OpenCode session 管理（`src/opencode/manager.ts`）
- AI 意图对齐、写作流程编排

### 前端调用后端

浏览器请求走 Next.js rewrite 代理（同源，消除 CORS），客户端代码用相对路径：

```typescript
// 客户端组件直接用 /api/* 相对路径
import { api } from "@/lib/api";
const data = await api.get(`/api/projects/${projectId}/...`);
```

rewrite 规则在 `packages/web/next.config.mjs`，目标由 `API_UPSTREAM` 环境变量控制（默认 `http://localhost:3200`）。

---

## 多用户隔离

- `(userId, projectId)` 独占一个 OpenCode session
- `userId` 暂从 `x-user-id` header 取（后续接 JWT 时替换为 token subject）
- SessionManager 维护 key = `${userId}:${projectId}` → OpenCode sessionId 的映射
- 30 分钟不活跃自动清理

---

## OpenCode 集成

- OpenCode serve 由 **`docker-compose.dev.yml`** 自动管理，镜像：`ghcr.io/anomalyco/opencode:latest`
- 端口：`4096`，健康检查：`GET /global/health`
- 认证：挂载本机 `~/.local/share/opencode/auth.json`（只读）
- 地址默认 `http://127.0.0.1:4096`，可通过 `OPENCODE_BASE_URL` 环境变量覆盖
- SDK：`@opencode-ai/sdk`，**必须传 `baseUrl`**，否则报 `Failed to parse URL from /session`
- `createOpencodeClient({ baseUrl })` 按需创建（每次请求，无状态）
- Session 创建：`client.session.create({ body: { title: "..." } })`
- 发消息：`client.session.prompt({ path: { id: sessionId }, body: { parts: [...] } })`
- 返回值：`{ data: { parts: [{ type: "text", text: "..." }] } }`
- 启动时健康检查：`sessionManager.checkHealth()` 在 `index.ts` 中调用，不可达则 crash + 打印明确错误

---

## 代码规范

### 禁止

- `as any` / `@ts-ignore` / `@ts-expect-error`
- `export default` 用于 Route Handler（用 `export async function POST`）
- 在 Next.js 里写业务逻辑 API
- 阻塞 Next.js 启动

### 测试

- 框架：vitest
- Server 路由测试：使用 `createApp()` + `app.request()`，不启动真实 HTTP
- 运行全部测试：`pnpm test`
- 类型检查：`pnpm typecheck`

---

## 里程碑状态

| 里程碑 | 状态 | 说明 |
|--------|------|------|
| M1.1–1.2 | ✅ 完成 | 基础架构、写作流程 |
| M1.3 | ✅ 完成 | Bridge 框架（core 包占位符） |
| M1.4 | ✅ 完成 | Bridge 真实集成（BridgeTransport 依赖注入 + 引擎串联路由） |
| Intent 路由迁移 | ✅ 完成 | Next.js → Hono，session 隔离 |
| Phase 2 | ✅ 完成 | 写作管道串联 + 筹备对齐路由 + AI POST 端点接引擎 |
| Phase 3 | ✅ 完成 | DrizzleKnowledgeStore + DrizzleLessonStore + core build 零错误 |
| Phase 4 | ✅ 完成 | 前端 15 个页面全部激活 + web typecheck 零错误 |
| Phase 5 | ✅ 完成 | 全量测试通过（core 610 + server 32 = 642 tests），typecheck 零错误 |
