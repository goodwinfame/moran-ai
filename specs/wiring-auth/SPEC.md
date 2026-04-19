# Phase 6: Wiring & Auth Foundation — SPEC

> **优先级**：P0（阻塞其他所有 Phase）
> **依赖**：Phase 1-5.3 已完成
> **设计文档**：`docs/v2-s11-technical-architecture.md` §6-7, `docs/v2-s4-ui-design.md` §4-6

---

## 1. 问题描述

Phase 1-5.3 实现了所有模块（DB、Service、MCP、API、SSE、前端组件），但存在关键接线断裂：

- ChatPanel 组件未渲染在 WorkspacePage 中（仅有占位注释）
- SSE `connect()` 从未被调用，实时事件无法流通
- InfoPanel 只读 IndexedDB 缓存，从不调 API 获取初始数据
- 无 Next.js Auth 中间件，路由不受保护
- 无 Login/Register 页面，用户无法认证

---

## 2. 验收标准

### AC-6.1: ChatPanel 渲染

- [ ] WorkspacePage 左侧面板渲染 `<ChatPanel projectId={projectId} />`
- [ ] 替换当前占位注释 `{/* ChatPanel placeholder — Phase 5.2 Agent B */}`
- [ ] ChatPanel 正确接收 projectId prop

### AC-6.2: SSE 自动连接

- [ ] 用户进入 `/projects/:id` 时，前端自动获取 OpenCode sessionId 并调用 `useSSEStore.connect(sessionId)`
- [ ] sessionId 通过 `GET /api/projects/:id/session` 获取（或从 chat store 的 session 初始化流程中获取）
- [ ] 离开页面时调用 `useSSEStore.disconnect()` 清理
- [ ] 连接状态变化在 UI 中可感知（connectionState: connecting → connected）

### AC-6.3: 面板数据初始加载

- [ ] InfoPanel mount 时，除了读 IndexedDB 缓存外，还调 API 获取各 Tab 最新数据
- [ ] 加载策略：先展示缓存（快速），API 返回后用新数据覆盖并更新缓存
- [ ] 至少以下 Tab 有对应 API fetch：brainstorm, world, character, outline, chapter
- [ ] API 请求使用已有的 panel-data 路由（`GET /api/projects/:id/brainstorms` 等）

### AC-6.4: Next.js Auth 中间件

- [ ] `packages/web/middleware.ts` 存在
- [ ] 拦截所有 `/projects/*` 路由
- [ ] 校验方式：检查 `session` cookie 存在且有效
- [ ] 未认证 → 302 重定向到 `/login`
- [ ] `/login`、`/register`、`/api/*`、`/_next/*`、`/favicon.ico` 不拦截
- [ ] 不阻塞 Next.js 启动（不做 DB 查询，只检查 cookie 存在性）

### AC-6.5: Login 页面

- [ ] `/login` 路由存在（`packages/web/src/app/login/page.tsx`）
- [ ] 邮箱 + 密码表单
- [ ] 提交调用 `POST /api/auth/login`
- [ ] 成功 → 跳转 `/`
- [ ] 失败 → 显示错误信息
- [ ] 有"去注册"链接跳转 `/register`

### AC-6.6: Register 页面

- [ ] `/register` 路由存在（`packages/web/src/app/register/page.tsx`）
- [ ] 邮箱 + 密码 + 确认密码表单
- [ ] 提交调用 `POST /api/auth/register`
- [ ] 成功 → 自动登录并跳转 `/`
- [ ] 失败 → 显示错误信息
- [ ] 有"去登录"链接跳转 `/login`

---

## 3. 技术方案

### 6.1 ChatPanel 渲染（1 行改动）

**文件**：`packages/web/src/components/workspace/WorkspacePage.tsx`

```tsx
// 添加 import
import { ChatPanel } from "@/components/chat/ChatPanel";

// 替换占位
<ChatPanel projectId={projectId} />
```

### 6.2 SSE 自动连接

**方案**：在 ChatPanel 或 WorkspacePage 的 useEffect 中初始化 SSE。

sessionId 获取流程：
1. ChatPanel mount 时调 `loadHistory(projectId)` — 这个已有
2. 新增：在 chat-store 的 `loadHistory` 或新方法中，调 `GET /api/projects/:id/session` 获取 sessionId
3. 如果 API 返回 sessionId，调 `useSSEStore.getState().connect(sessionId)`
4. unmount 时 disconnect

**注意**：`useSSEStore.connect(sessionId)` 需要的是 OpenCode session ID，不是 projectId。
后端 `GET /api/projects/:id/session` 应调用 `OpenCodeSessionManager.getOrCreateSession(userId, projectId)` 返回 sessionId。

**API 端点**（如不存在需新建）：
```
GET /api/projects/:id/session → { sessionId: string }
```

### 6.3 面板数据初始加载

**方案**：在 panel-store 中添加 `fetchInitialData(projectId)` 方法。

```typescript
// panel-store.ts 中新增
fetchInitialData: async (projectId: string) => {
  // 并行请求各 Tab 数据
  const [brainstorms, worlds, characters, outlines, chapters] = await Promise.allSettled([
    api.get(`/api/projects/${projectId}/brainstorms`),
    api.get(`/api/projects/${projectId}/worlds`),
    api.get(`/api/projects/${projectId}/characters`),
    api.get(`/api/projects/${projectId}/outlines`),
    api.get(`/api/projects/${projectId}/chapters`),
  ]);
  // 更新 store + 写入 IndexedDB 缓存
}
```

调用点：InfoPanel mount 时，在 `initFromCache` 之后调用 `fetchInitialData`。

### 6.4 Auth 中间件

**文件**：`packages/web/middleware.ts`（Next.js 规范位置）

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("session");
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/projects/:path*"],
};
```

### 6.5-6.6 Login/Register 页面

简洁表单组件，使用已有的 shadcn/ui（Input, Button, Card）。
调用已有的 `POST /api/auth/login` 和 `POST /api/auth/register`。
样式参考设计色系：深海军蓝 primary，白色背景。

---

## 4. 测试要求

| 测试 | 类型 | 文件 |
|------|------|------|
| WorkspacePage 渲染 ChatPanel | 单元 | `__tests__/components/workspace/WorkspacePage.test.tsx` |
| SSE connect 在 mount 时调用 | 单元 | 更新现有 ChatPanel 测试 |
| SSE disconnect 在 unmount 时调用 | 单元 | 同上 |
| Panel fetchInitialData 调 API | 单元 | `__tests__/stores/panel-store.test.ts` |
| Auth middleware 拦截未认证请求 | 单元 | `__tests__/middleware.test.ts` |
| Auth middleware 放行已认证请求 | 单元 | 同上 |
| Login 页面渲染 + 提交 | 单元 | `__tests__/app/login.test.tsx` |
| Register 页面渲染 + 提交 | 单元 | `__tests__/app/register.test.tsx` |

---

## 5. 修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/web/src/components/workspace/WorkspacePage.tsx` | MODIFY | 导入并渲染 ChatPanel |
| `packages/web/src/components/chat/ChatPanel.tsx` | MODIFY | 添加 SSE connect/disconnect lifecycle |
| `packages/web/src/stores/panel-store.ts` | MODIFY | 添加 fetchInitialData 方法 |
| `packages/web/src/components/panel/InfoPanel.tsx` | MODIFY | mount 时调 fetchInitialData |
| `packages/web/middleware.ts` | NEW | Auth 中间件 |
| `packages/web/src/app/login/page.tsx` | NEW | Login 页面 |
| `packages/web/src/app/register/page.tsx` | NEW | Register 页面 |
| `packages/api-server/src/routes/session.ts` | NEW（如不存在） | GET /api/projects/:id/session 端点 |
| 测试文件 | NEW/MODIFY | 见测试要求 |
