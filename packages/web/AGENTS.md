# AGENTS.md — packages/web

> Next.js 前端包。只做渲染，不写业务逻辑 API。

---

## V2 包职责

1. **页面渲染**：仅 2 个路由（`/` 项目列表、`/projects/:id` 主工作页）
2. **静态资源**：public/ 目录
3. **API 代理**：next.config.mjs rewrite `/api/*` → Hono

## V2 页面结构

| 路由 | 说明 |
|------|------|
| `/` | 项目列表页 |
| `/projects/:id` | 主工作页（聊天窗口 + 信息面板） |

## 调用后端

浏览器请求走 Next.js rewrite 代理（同源），客户端代码直接用相对路径：

```typescript
import { api } from "@/lib/api";
const data = await api.get(`/api/projects/${projectId}/...`);
```

## 关键目录

| 目录 | 说明 |
|------|------|
| `src/app/` | Next.js App Router 页面 |
| `src/components/ui/` | shadcn/ui 基础组件 |
| `src/lib/` | 工具函数（cn, api client） |

## V2 变更

V1 的 15 个页面、所有业务组件、hooks、stores 已全部删除。
V2 UI 将按 SDD Spec 从头实现，仅保留 shadcn/ui 原子组件和设计 token。

## 禁止事项

- 不能在 Route Handler 里写业务逻辑
- 不能直接调 OpenCode SDK
- 不能 `as any` / `@ts-ignore`
- 不能阻塞 Next.js 启动（不能在模块顶层 await）
