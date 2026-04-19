# api-routes — SPEC

> **状态**：已完成
> **模块**：api-routes
> **最后更新**：2026-04-19

## 1. 概述

Hono 后端的 RESTful API 路由层。分为三大类：Chat API（对话通道）、Panel API（面板数据）、User API（用户信息）。
所有 API 在 `packages/server` 中实现，前缀 `/api`，通过 Next.js rewrite 代理实现同源访问。

技术栈：Hono + TypeScript，测试用 `createApp()` + `app.request()`，不启动真实 HTTP。

## 2. 功能需求

### 2.1 Chat API（对话通道）

| 方法 | 路径 | 功能 | 说明 |
|------|------|------|------|
| POST | `/api/chat/send` | 发送用户消息 | body: `{ projectId, message, attachments? }`。转发给 OpenCode session，返回 `{ ok, messageId }` |
| GET | `/api/chat/events` | 订阅 SSE 事件流 | query: `?sessionId=...&lastEventId=...`。返回 SSE stream（text/event-stream） |
| GET | `/api/chat/history` | 获取历史消息 | query: `?projectId=...&limit=50&before=...`。返回 `{ messages[], hasMore }` |

### 2.2 Panel API（面板数据）

所有 Panel API 路径前缀 `/api/projects/:projectId`。返回格式统一 `{ ok: boolean, data?: T, error?: { code, message } }`。

#### 项目管理

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/projects` | 获取项目列表（当前用户） |
| POST | `/projects` | 创建新项目 |
| GET | `/projects/:id` | 获取项目详情 |
| PATCH | `/projects/:id` | 更新项目信息 |
| DELETE | `/projects/:id` | 删除项目 |

#### 脑暴

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/projects/:id/brainstorms` | 获取脑暴记录（按阶段：diverge/focus/brief） |

#### 世界设定

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/projects/:id/world-settings` | 获取所有世界设定（含子系统） |
| GET | `/projects/:id/world-settings/:settingId` | 获取单个子系统详情 |
| GET | `/projects/:id/world-settings/search` | 搜索设定内容 |

#### 角色

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/projects/:id/characters` | 获取角色列表（含筛选：role, tier） |
| GET | `/projects/:id/characters/:charId` | 获取角色详情（含 DNA、状态、关系） |
| GET | `/projects/:id/characters/:charId/states` | 获取角色状态历史 |
| GET | `/projects/:id/relationships` | 获取关系列表（关系图数据） |

#### 大纲

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/projects/:id/outline` | 获取完整大纲（弧段 + 章节 Brief） |
| GET | `/projects/:id/outline/arcs/:arcIndex` | 获取单个弧段详情 |

#### 章节

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/projects/:id/chapters` | 获取章节列表（摘要） |
| GET | `/projects/:id/chapters/:num` | 获取章节正文 |
| GET | `/projects/:id/chapters/:num/versions` | 获取章节版本历史 |

#### 审校

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/projects/:id/reviews` | 获取审校报告列表 |
| GET | `/projects/:id/reviews/:chapterNum` | 获取某章的审校报告（含四轮详情） |

#### 分析

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/projects/:id/analysis` | 获取分析报告列表 |
| GET | `/projects/:id/analysis/:chapterNum` | 获取某章的九维分析 |
| GET | `/projects/:id/analysis/trend` | 获取趋势数据（多章评分折线） |

#### 知识库

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/projects/:id/knowledge` | 获取知识条目（分页，可按分类/关键词筛选） |

#### Agent 状态

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/projects/:id/agent-status` | 获取当前活跃 Agent 状态列表（SSE 断线重连用） |

#### 统计

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/projects/:id/stats` | 获取项目统计（字数、章节数、Token 消耗等） |

### 2.3 User API（用户信息）

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/user/profile` | 获取当前用户信息 |
| PATCH | `/api/user/profile` | 更新用户信息（昵称、偏好） |
| GET | `/api/user/stats` | 获取用户全局统计（总消耗、项目数） |

### 2.4 统一响应格式

```typescript
// 成功
{ ok: true, data: T }

// 失败
{ ok: false, error: { code: string, message: string } }

// 分页
{ ok: true, data: T[], pagination: { total: number, page: number, pageSize: number, hasMore: boolean } }
```

### 2.5 错误处理

- 统一错误中间件（已有 `error-handler.ts`）
- HTTP 状态码：400 参数错误、401 未认证、403 无权限、404 资源不存在、500 服务端错误
- 错误码枚举：`VALIDATION_ERROR | NOT_FOUND | UNAUTHORIZED | FORBIDDEN | INTERNAL_ERROR`

### 2.6 路由组织

```
packages/server/src/routes/
  chat.ts       — Chat API (3 路由)
  projects.ts   — 项目 CRUD (5 路由)
  panel/
    brainstorms.ts
    world-settings.ts
    characters.ts
    outline.ts
    chapters.ts
    reviews.ts
    analysis.ts
    knowledge.ts
    agent-status.ts
    stats.ts
  user.ts       — User API (3 路由)
```

## 3. 验收标准

- [ ] Chat API 3 个端点全部实现且有路由测试
- [ ] Panel API 全部端点实现且有路由测试（每个端点至少 1 个成功 + 1 个失败用例）
- [ ] User API 3 个端点全部实现且有路由测试
- [ ] SSE 端点 `/api/chat/events` 返回 `Content-Type: text/event-stream`
- [ ] 统一响应格式 `{ ok, data?, error? }` 在所有端点遵守
- [ ] 错误中间件捕获未处理异常，返回 500 + 标准格式
- [ ] 所有测试使用 `createApp()` + `app.request()`，不启动真实 HTTP
- [ ] `pnpm typecheck` 通过（server 包零错误）

## 4. 依赖

- 依赖 `database` 模块（schema + DB 连接）
- 依赖 `opencode-integration` 模块（Chat API 需转发给 OpenCode）
- 依赖 `sse-realtime` 模块（SSE 事件流）
- 被 `chat-ui`、`info-panel`、`project-list` 前端模块消费
