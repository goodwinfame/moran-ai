# api-routes — DESIGN

> **状态**：已完成
> **模块**：api-routes

## 1. 当前状态

V2 清理后，`packages/server/src/` 只剩最小骨架：

| 文件 | 状态 | 说明 |
|------|------|------|
| `app.ts` | ✅ 骨架就绪 | `createApp()` + 全局中间件 + `/health` |
| `index.ts` | ✅ 简化启动 | HTTP 监听器 |
| `middleware/error-handler.ts` | ✅ 可用 | 全局错误中间件 |
| `opencode/manager.ts` | ✅ 可用 | SessionManager 单例 |
| `routes/` | ❌ 不存在 | 需全部新建 |

## 2. 技术方案

### 2.1 路由文件组织

```
packages/server/src/routes/
├── chat.ts               ← Chat API（3 路由）
├── projects.ts           ← 项目 CRUD（5 路由）
├── user.ts               ← User API（3 路由）
└── panel/
    ├── index.ts           ← 面板路由聚合导出
    ├── brainstorms.ts     ← 脑暴数据
    ├── world-settings.ts  ← 世界设定
    ├── characters.ts      ← 角色数据
    ├── outline.ts         ← 大纲数据
    ├── chapters.ts        ← 章节数据
    ├── reviews.ts         ← 审校报告
    ├── analysis.ts        ← 分析数据
    ├── knowledge.ts       ← 知识库
    ├── agent-status.ts    ← Agent 实时状态
    └── stats.ts           ← 项目统计
```

### 2.2 路由工厂模式

遵循 server/AGENTS.md 约定，每个路由文件导出工厂函数：

```typescript
// routes/projects.ts
import { Hono } from "hono";

export function createProjectRoutes() {
  const routes = new Hono();

  routes.get("/", async (c) => { /* 项目列表 */ });
  routes.post("/", async (c) => { /* 创建项目 */ });
  routes.get("/:id", async (c) => { /* 项目详情 */ });
  routes.patch("/:id", async (c) => { /* 更新项目 */ });
  routes.delete("/:id", async (c) => { /* 删除项目 */ });

  return routes;
}
```

### 2.3 路由挂载（app.ts）

```typescript
// app.ts 中挂载
import { createChatRoutes } from "./routes/chat.js";
import { createProjectRoutes } from "./routes/projects.js";
import { createPanelRoutes } from "./routes/panel/index.js";
import { createUserRoutes } from "./routes/user.js";

// ── V2 路由 ──
app.route("/api/chat", createChatRoutes());
app.route("/api/projects", createProjectRoutes());
app.route("/api/user", createUserRoutes());

// Panel 路由挂载在 /api/projects/:id/ 下
// createPanelRoutes() 内部聚合所有面板子路由
app.route("/api/projects/:id", createPanelRoutes());
```

### 2.4 统一响应工具

```typescript
// packages/server/src/utils/response.ts
import type { Context } from "hono";

export function ok<T>(c: Context, data: T, status = 200) {
  return c.json({ ok: true, data }, status);
}

export function fail(c: Context, code: string, message: string, status = 400) {
  return c.json({ ok: false, error: { code, message } }, status);
}

export function paginated<T>(
  c: Context,
  data: T[],
  pagination: { total: number; page: number; pageSize: number; hasMore: boolean },
) {
  return c.json({ ok: true, data, pagination });
}
```

### 2.5 userId 获取中间件

```typescript
// packages/server/src/middleware/user-id.ts
import type { Context, Next } from "hono";

/**
 * 从请求头提取 userId，fallback 到 "anonymous"。
 * 设置到 c.set("userId", ...) 供路由使用。
 */
export async function userIdMiddleware(c: Context, next: Next) {
  const userId = c.req.header("x-user-id") ?? "anonymous";
  c.set("userId", userId);
  await next();
}
```

### 2.6 Zod 校验模式

请求体/查询参数使用 Zod 校验：

```typescript
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

const createProjectSchema = z.object({
  title: z.string().min(1).max(500),
  genre: z.string().max(100).optional(),
  subGenre: z.string().max(100).optional(),
});

routes.post("/", zValidator("json", createProjectSchema), async (c) => {
  const body = c.req.valid("json");
  // ...
});
```

### 2.7 DB 查询层

路由 handler 直接使用 Drizzle ORM 查询，不封装额外 service 层（保持 V2 简洁原则）：

```typescript
import { getDb } from "@moran/core/db";
import { projects } from "@moran/core/db/schema";
import { eq } from "drizzle-orm";

routes.get("/:id", async (c) => {
  const db = getDb();
  const id = c.req.param("id");
  const project = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!project.length) return fail(c, "NOT_FOUND", "Project not found", 404);
  return ok(c, project[0]);
});
```

### 2.8 Chat API 特殊设计

Chat API 与 Panel API 不同——它是 OpenCode 的代理层：

- `POST /api/chat/send`：接收消息 → 通过 SessionManager 获取 sessionId → 调用 OpenCode SDK `session.prompt()`
- `GET /api/chat/events`：SSE 端点 → 代理 OpenCode 事件流（详见 sse-realtime DESIGN）
- `GET /api/chat/history`：调用 OpenCode SDK `session.messages()` 获取历史

```typescript
// routes/chat.ts
import { sessionManager } from "../opencode/manager.js";

routes.post("/send", async (c) => {
  const { projectId, message } = await c.req.json();
  const userId = c.get("userId");
  const sessionId = await sessionManager.getOrCreateSession(userId, projectId);
  const client = sessionManager.createClient();
  const result = await client.session.prompt({
    params: { id: sessionId },
    body: { parts: [{ type: "text", text: message }] },
  });
  return ok(c, { messageId: result.data?.id });
});
```

### 2.9 测试策略

所有路由测试使用 `createApp()` + `app.request()` 模式：

```typescript
import { describe, it, expect, vi } from "vitest";
import { createApp } from "../app.js";

describe("GET /api/projects", () => {
  it("returns project list", async () => {
    const { app } = createApp();
    const res = await app.request("/api/projects", {
      headers: { "x-user-id": "test-user" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
```

DB 操作需要 mock 或使用测试数据库。优先使用 `vitest.mock()` mock Drizzle 查询。

### 2.10 新增依赖

| 包 | 用途 | 安装位置 |
|----|------|---------|
| `zod` | 请求校验 | server |
| `@hono/zod-validator` | Hono + Zod 集成 | server |

## 3. 不需要改动的部分

- `middleware/error-handler.ts`（已有，符合需求）
- `opencode/manager.ts`（已有，Chat API 直接使用）
- Docker 配置
- Next.js rewrite 代理（已有）

## 4. 风险与注意事项

- **Chat API 依赖 OpenCode**：测试时需 mock OpenCode SDK 调用
- **Panel 路由数量多（~20 端点）**：分批实现，优先实现项目 CRUD + 聊天端点
- **SSE 端点跨模块**：`GET /api/chat/events` 路由定义在 api-routes，但实现逻辑在 sse-realtime
