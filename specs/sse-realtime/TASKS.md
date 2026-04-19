# sse-realtime — TASKS

> **模块**：sse-realtime

## 任务列表

### T1: 实现 EventTransformer
- **输出**：`packages/server/src/sse/transformer.ts`
  - OpenCode 原生事件 → SSE 前端事件格式转换
  - 14 种事件类型映射（8 种 Chat + 3 种 Chapter + 3 种 Brainstorm）
  - 单调递增事件 ID 生成
- **验收**：单元测试覆盖所有 14 种事件类型转换

### T2: 实现 SSEBroadcaster
- **输出**：`packages/server/src/sse/broadcaster.ts`
  - 连接管理（add / remove）
  - 事件广播（session → 所有连接）
  - EventBuffer 集成（断线回放）
  - 过期清理
- **验收**：单元测试覆盖广播、回放、清理

### T3: 实现 SSE 端点
- **输入**：T1 + T2 + api-routes 模块的 chat 路由骨架
- **输出**：`GET /api/chat/events` 完整实现
  - `Last-Event-Id` 断线恢复
  - 心跳每 30s
  - OpenCode 事件流订阅 + 转换 + 推送
- **验收**：
  - SSE 端点返回 `Content-Type: text/event-stream`
  - 心跳间隔 30s
  - 断线后带 `Last-Event-Id` 恢复缺失事件

### T4: 实现前端 SSEClient
- **输出**：`packages/web/src/lib/sse-client.ts`
  - EventSource 封装
  - 指数退避自动重连（1s → 2s → 4s → ... → 30s max）
  - 心跳监控（60s 无心跳主动重连）
  - 事件分发到 handler
- **验收**：单元测试覆盖重连逻辑、心跳超时

### T5: 实现 Zustand SSE Store
- **输出**：`packages/web/src/stores/sse-store.ts`
  - connect / disconnect action
  - connectionState 状态管理
  - 事件 handler 注册到各业务 store
- **验收**：store 单元测试

### T6: 实现 Agent 状态 Store
- **输出**：`packages/web/src/stores/agent-store.ts`
  - AgentStatus 数据模型
  - SSE 事件驱动：subtask_start / progress / end
  - 3 秒淡出清理（just_finished → 移除）
  - `restoreFromAPI()` 断线恢复
- **验收**：store 单元测试，状态转换正确

### T7: 实现面板事件路由
- **输出**：`packages/web/src/lib/panel-event-router.ts`
  - tool_result 工具名 → Tab 映射表
  - 10 秒操作保护逻辑
  - Tab 徽标管理
- **验收**：映射表覆盖所有 47 个工具，保护逻辑有单元测试

### T8: 实现 IndexedDB 离线缓存
- **输出**：`packages/web/src/lib/offline-cache.ts`
  - 安装 `idb` 依赖
  - openCache / cacheTabData / getCachedTabData
  - 面板数据读取时先查缓存
- **验收**：缓存读写测试通过

### T9: 验证全局构建
- **输入**：T1-T8 完成
- **输出**：`pnpm typecheck` + `pnpm test` 全部通过
- **验收**：零错误

## 依赖关系

```
T1 ─┬→ T3 ──→ T9
T2 ─┘
T4 ─→ T5 ─→ T9
T6 ────→ T9
T7 ────→ T9
T8 ────→ T9
```

服务端 T1+T2→T3 形成链路。前端 T4-T8 相互独立可并行。T9 最终验证。

**跨模块依赖**：
- T3 依赖 api-routes 模块的 chat 路由骨架（可先独立实现 SSE 逻辑）
- T3 依赖 opencode-integration 模块的 `subscribeEvents()` 方法
