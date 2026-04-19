# sse-realtime — SPEC

> **状态**：已完成
> **模块**：sse-realtime
> **最后更新**：2026-04-19

## 1. 概述

SSE 实时通信模块。负责将 OpenCode 事件流和面板数据变更实时推送到前端浏览器。
两条数据通道：Chat SSE（聊天流式输出）+ Panel SSE（面板数据更新通知）。

## 2. 功能需求

### 2.1 Chat SSE 事件类型

通过 `/api/chat/events?sessionId=...` 订阅，返回 `Content-Type: text/event-stream`。

**通用事件**（所有场景）：

| 事件类型 | 来源 | 前端处理 |
|----------|------|----------|
| `text` | 墨衡流式文本输出 | 聊天窗口逐字追加 |
| `tool_call` | Agent 调用 MCP 工具 | 聊天窗口显示进度 |
| `tool_result` | MCP 工具返回结果 | 触发面板自动切 Tab + 数据刷新（映射见 §2.2） |
| `subtask_start` | 子 Agent 开始工作 | Agent 状态条新增一行 |
| `subtask_progress` | 子 Agent 工作进展 | Agent 状态条更新描述文案 |
| `subtask_end` | 子 Agent 完成 | Agent 状态条变灰 + 3秒淡出 |
| `error` | 错误发生 | 聊天窗口显示错误提示 |
| `interaction_mode` | 墨衡需要用户决策 | 输入框替换为 Question Panel |

**章节写作专用事件**（执笔写作时触发）：

| 事件类型 | 频率 | 前端处理 |
|----------|------|----------|
| `chapter.start` | 每章一次 | 章节 Tab 加 🔴，进入写作模式 |
| `chapter.token` | ~500ms | 追加文字 + 更新字数 |
| `chapter.complete` | 每章一次 | 移除 🔴，切回阅读模式 |

**脑暴专用事件**（灵犀脑暴时触发）：

| 事件类型 | 前端处理 |
|----------|----------|
| `brainstorm.diverge` | 追加到发散区域 |
| `brainstorm.converge` | 更新聚焦区域 |
| `brainstorm.crystallize` | 渲染结晶卡片 + 自动切 Tab |

> 共计 **14 种事件类型**：8 通用 + 3 章节专用 + 3 脑暴专用。

### 2.2 Panel SSE 事件映射

从 `tool_result` 事件提取工具名，映射到面板 Tab 更新。面板数据始终更新，无论 Tab 是否激活。

| tool_result 工具名 | 目标 Tab | 面板行为 |
|-------------------|----------|----------|
| `brainstorm_create/update` | 脑暴 | 追加/更新方案 |
| `world_create/update/delete` | 设定 | 刷新卡片/详情 |
| `character_*`, `character_state_create`, `relationship_*` | 角色 | 追加/更新角色卡片 |
| `outline_create/update` | 大纲 | 更新树结构 |
| `chapter_create/update/archive`, `style_create/update`, `summary_create` | 章节 | 更新章节列表/状态 |
| `review_execute` | 审校 | 渲染评分条+详情 |
| `analysis_execute` | 分析 | 渲染雷达图+趋势图 |
| `knowledge_*`, `lesson_*`, `thread_*`, `timeline_*` | 知识库 | 追加/更新条目 |

### 2.3 Agent 状态条数据模型

```typescript
interface AgentStatus {
  agentId: string;           // "zhibi", "mingjing", etc.
  displayName: string;       // "执笔·剑心", "明镜", etc.
  state: 'active' | 'queued' | 'background' | 'just_finished';
  description: string;       // "写作第 38 章 · 1,847字"
  startedAt: number;         // Unix timestamp
  targetTab?: string;        // 点击跳转的 Tab
}
```

**状态灯颜色**：

| 状态 | 颜色 | 说明 |
|------|------|------|
| active | 🟢 绿色 | 正在执行，有实时输出 |
| queued | 🟡 黄色 | 已分配，等待前序 Agent |
| background | 🔵 蓝色 | 后台处理（归档、分析） |
| just_finished | ⚪ 灰色 | 完成，3秒后淡出移除 |

### 2.4 面板 10 秒操作保护

当 SSE 事件触发面板自动切 Tab 时，需检查用户最后操作时间：

```typescript
function handleAutoSwitch(targetTab: TabId) {
  const now = Date.now();
  const lastUserAction = uiStore.getState().lastUserActionTime;
  if (now - lastUserAction < 10_000) {
    tabStore.addBadge(targetTab, "dot");  // 仅加红点
  } else {
    tabStore.setActive(targetTab);         // 自动切换
  }
}
```

**用户操作**定义：点击、滚动、选中文字、键盘输入。鼠标移动不算。

### 2.5 断线重连

| 机制 | 规格 |
|------|------|
| 自动重连 | SSE 断开后自动重连，指数退避（1s → 2s → 4s → 8s → 16s → 最大 30s） |
| 状态恢复 | 重连后调用 `GET /api/projects/:id/agent-status` 一次性拉取当前全部 Agent 状态 |
| lastEventId | 利用 SSE `Last-Event-Id` header 恢复断点续传 |
| 心跳 | 服务端每 30s 发送 `:heartbeat` 注释行，前端超时 60s 无心跳则主动重连 |
| 离线缓存 | 面板数据持久化到 IndexedDB，断线期间不显示空白 |

### 2.6 服务端 SSE 实现

```typescript
// Hono SSE 路由
app.get('/api/chat/events', async (c) => {
  const sessionId = c.req.query('sessionId');
  const lastEventId = c.req.header('Last-Event-Id');
  
  return c.streamSSE(async (stream) => {
    // 1. 如果有 lastEventId，先回放缺失事件
    // 2. 订阅 OpenCode 事件流
    // 3. 转换为前端事件格式并推送
    // 4. 每 30s 发送心跳
  });
});
```

### 2.7 前端 SSE 客户端

```typescript
// Zustand store 管理 SSE 连接
interface SSEStore {
  eventSource: EventSource | null;
  connectionState: 'connecting' | 'connected' | 'disconnected';
  reconnectAttempts: number;
  connect(sessionId: string): void;
  disconnect(): void;
}
```

## 3. 验收标准

### Chat SSE

- [ ] `/api/chat/events` 返回 `Content-Type: text/event-stream`
- [ ] 8 种事件类型全部实现并有测试
- [ ] `Last-Event-Id` 断点续传正常工作
- [ ] 心跳每 30s 发送

### Panel SSE

- [ ] `tool_result` 事件正确映射到面板 Tab
- [ ] 面板数据更新与 Tab 切换解耦（数据始终更新，切换受保护）
- [ ] 10 秒操作保护机制正常工作
- [ ] 章节写作流式渲染（`chapter.token` 事件驱动）
- [ ] 增量更新（追加/更新，不重载整个 Tab）

### Agent 状态条

- [ ] `subtask_start` → 新增状态行（滑入动画）
- [ ] `subtask_progress` → 原地刷新描述文案
- [ ] `subtask_end` → 变灰 + 3秒淡出
- [ ] 最多显示 2 行，溢出折叠为 "+N 个 Agent 工作中"
- [ ] 点击状态行打开 Agent 会话抽屉

### 断线重连

- [ ] 断开后自动重连（指数退避，最大 30s）
- [ ] 重连后正确恢复 Agent 状态
- [ ] 60s 无心跳主动重连
- [ ] IndexedDB 离线缓存面板数据

### 通用

- [ ] `pnpm typecheck` 通过
- [ ] 所有测试通过

## 4. 依赖

- 依赖 `opencode-integration` 模块（事件源来自 OpenCode）
- 依赖 `api-routes` 模块（SSE 端点在 api-routes 中注册）
- 被 `chat-ui`、`info-panel` 前端模块消费
