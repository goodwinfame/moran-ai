# api-routes — TASKS

> **模块**：api-routes

## 任务列表

### T1: 创建路由基础设施
- **输入**：`packages/api-server/src/`
- **输出**：
  - `routes/` 目录结构
  - `utils/response.ts`（ok / fail / paginated 工具）
  - （认证中间件由 auth 模块 T5 提供，见 `specs/auth/TASKS.md`）
  - `app.ts` 更新：挂载 auth 模块的 `requireAuth` 中间件
- **验收**：`pnpm typecheck` 通过

### T2: 安装 Zod 校验依赖
- **输入**：`packages/api-server/package.json`
- **输出**：`zod` + `@hono/zod-validator` 已安装
- **验收**：`import { z } from "zod"` 不报错

### T3: 实现项目 CRUD 路由（5 端点）
- **输入**：`packages/core/src/db/schema/projects.ts`
- **输出**：`routes/projects.ts`
  - `GET /api/projects`（列表，按 updatedAt 倒序）
  - `POST /api/projects`（创建，Zod 校验 body）
  - `GET /api/projects/:id`（详情）
  - `PATCH /api/projects/:id`（更新）
  - `DELETE /api/projects/:id`（删除）
- **验收**：5 端点路由测试通过（每端点 1 成功 + 1 失败用例）

### T4: 实现 Chat API（3 端点）
- **输入**：`opencode/manager.ts`
- **输出**：`routes/chat.ts`
  - `POST /api/chat/send`（发送消息 → OpenCode）
  - `GET /api/chat/events`（SSE 端点骨架，具体实现在 sse-realtime 模块）
  - `GET /api/chat/history`（获取历史消息）
- **验收**：路由测试通过（OpenCode SDK mock）

### T5: 实现 User API（3 端点）
- **输入**：用户信息表（若 DB 无 users 表则使用 header fallback）
- **输出**：`routes/user.ts`
  - `GET /api/user/profile`
  - `PATCH /api/user/profile`
  - `GET /api/user/stats`
- **验收**：路由测试通过

### T6: 实现 Panel 路由 — 脑暴 + 设定
- **输出**：
  - `routes/panel/brainstorms.ts`（GET 脑暴记录）
  - `routes/panel/world-settings.ts`（GET 设定列表、详情、搜索）
- **验收**：路由测试通过

### T7: 实现 Panel 路由 — 角色 + 大纲
- **输出**：
  - `routes/panel/characters.ts`（角色列表、详情、状态历史、关系）
  - `routes/panel/outline.ts`（完整大纲、弧段详情）
- **验收**：路由测试通过

### T8: 实现 Panel 路由 — 章节 + 审校
- **输出**：
  - `routes/panel/chapters.ts`（章节列表、正文、版本历史）
  - `routes/panel/reviews.ts`（审校报告列表、某章审校详情）
- **验收**：路由测试通过

### T9: 实现 Panel 路由 — 分析 + 知识库 + Agent 状态 + 统计
- **输出**：
  - `routes/panel/analysis.ts`（分析报告列表、某章分析、趋势数据）
  - `routes/panel/knowledge.ts`（知识条目，分页+筛选）
  - `routes/panel/agent-status.ts`（当前活跃 Agent 状态）
  - `routes/panel/stats.ts`（项目统计）
- **验收**：路由测试通过

### T10: Panel 路由聚合 + app.ts 挂载
- **输入**：T6-T9 的路由模块
- **输出**：
  - `routes/panel/index.ts`（聚合所有面板路由）
  - `app.ts` 更新：挂载全部路由
- **验收**：所有端点可访问，`pnpm typecheck` + `pnpm test` 通过

### T11: 验证全局构建
- **输入**：T1-T10 完成后的代码库
- **输出**：`pnpm typecheck` + `pnpm test` 全部通过
- **验收**：零错误

## 依赖关系

```
T1 ─┬→ T3 ─┐
T2 ─┘       │
T1 ──→ T4   │
T1 ──→ T5   ├→ T10 → T11
T1 ──→ T6   │
T1 ──→ T7   │
T1 ──→ T8   │
T1 ──→ T9 ──┘
```

T1+T2 是基础设施。T3-T9 可大致并行（均依赖 T1 基础设施）。T10 聚合挂载，T11 最终验证。

**跨模块依赖**：T4 的 SSE 端点实现依赖 sse-realtime 模块（可先出骨架，后续填充）。
