# AGENTS.md — packages/web

> Next.js 前端包。只做渲染，不写业务逻辑 API。

---

## 包职责

1. **页面渲染**：Server Components / Client Components
2. **静态资源**：public/ 目录
3. **Auth 中间件**：`middleware.ts` 校验 session cookie

## 调用后端

浏览器请求走 Next.js rewrite 代理（同源），客户端代码直接用相对路径：

```typescript
// 客户端组件：直接用 /api/* 相对路径，Next.js rewrite 代理到 Hono
import { api } from "@/lib/api";
const data = await api.get(`/api/projects/${projectId}/intent`);

// 或直接 fetch
const res = await fetch(`/api/projects/${projectId}/intent`, { ... });
```

rewrite 规则在 `next.config.mjs` 中配置，目标地址由 `API_UPSTREAM` 环境变量控制（默认 `http://localhost:3200`）。

## Route Handler 规则

- **几乎不应该存在**。唯一例外：tombstone（返回 410）
- 如果你想写业务逻辑，放到 `packages/server` 的 Hono 路由里
- 已有的 tombstone 示例：`src/app/api/prep/[projectId]/intent/route.ts`（返回 410）

## 关键目录

| 目录 | 说明 |
|------|------|
| `src/app/` | Next.js App Router 页面 |
| `src/components/` | 共享 UI 组件 |
| `src/stores/` | Zustand store（客户端状态） |
| `src/hooks/` | 自定义 React hooks |

## 组件约定

- 业务组件放 `src/components/<feature>/`
- 共享 UI 原子组件放 `src/components/ui/`
- Client Component 文件顶部加 `"use client"`
- Server Component 不加（默认）

## 禁止事项

- 不能在 Route Handler 里写业务逻辑
- 不能直接调 OpenCode SDK
- 不能 `as any` / `@ts-ignore`
- 不能阻塞 Next.js 启动（不能在模块顶层 await）
