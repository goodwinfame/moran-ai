# Phase 8: Logging System — SPEC

> **设计文档**：`docs/v2-s11-technical-architecture.md` §11（D15）

---

## 1. 概述

结构化 Agent 日志系统：Agent 活动和工具调用日志持久化到 DB，支持按项目/Agent/级别查询，自动清理过期日志。

**注意**：已有 `decision_logs` 表（门禁决策日志）和 pino logger（Console 输出）。本 Phase 新增 `agent_logs` 表用于 Agent 活动+工具调用的持久化，以及查询 API。

---

## 2. 验收标准

### AC-8.1: DB Schema

- [ ] `agent_logs` 表存在（在已有的 `packages/core/src/db/schema/logs.ts` 中新增）
- [ ] 字段：id, projectId, userId, sessionId, level, category, agentName, toolName, message, durationMs, metadata, createdAt
- [ ] category 值域：`"agent" | "tool" | "auth" | "sse"`
- [ ] 索引：(project_id, created_at DESC), (category, created_at DESC)
- [ ] 与已有 `decisionLogs` 表共存

### AC-8.2: LogService

- [ ] `packages/core/src/services/log.service.ts` 存在
- [ ] `writeLog(entry: LogEntry)`: 异步写入 DB + Console 输出
  - `category === "app"` 只写 Console 不写 DB
  - debug 级别不写 DB
  - 写入失败不抛异常（catch + console.error）
- [ ] `query({ projectId, category?, level?, limit?, offset? })`: 分页查询
  - 返回 `{ logs: LogEntry[], total: number, hasMore: boolean }`
- [ ] `cleanup(retentionDays: number)`: 删除过期日志
- [ ] 导出 LogEntry 类型

### AC-8.3: withLogging 装饰器

- [ ] `packages/core/src/services/with-logging.ts` 存在
- [ ] 包装 Service 方法，自动记录：toolName、耗时、成功/失败、输入摘要
- [ ] 不记录完整输入（可能包含大段文本），只记录关键标识字段

### AC-8.4: Log 查询 API

- [ ] `GET /api/projects/:id/logs` — 分页查询日志
  - 支持 `?category=&level=&limit=&offset=` 查询参数
- [ ] 路由挂载在 `packages/api-server/src/app.ts`
- [ ] 需 `requireAuth` 中间件

### AC-8.5: Log 清理 Job

- [ ] `packages/api-server/src/jobs/log-cleanup.ts` 存在
- [ ] 默认保留 90 天
- [ ] `startLogCleanup()` 导出，在 API Server 启动时注册
- [ ] 使用 `setInterval`，每 24 小时执行一次
- [ ] `agent_logs` 和 `usage_records` 均清理（usage_records 保留 365 天）

---

## 3. 修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/core/src/db/schema/logs.ts` | MODIFY | 新增 agentLogs 表（与 decisionLogs 共存） |
| `packages/core/src/services/log.service.ts` | NEW | LogService |
| `packages/core/src/services/with-logging.ts` | NEW | withLogging 装饰器 |
| `packages/core/src/services/index.ts` | MODIFY | 添加 export |
| `packages/api-server/src/routes/logs.ts` | NEW | Log 查询 API |
| `packages/api-server/src/app.ts` | MODIFY | 挂载 logs 路由 |
| `packages/api-server/src/jobs/log-cleanup.ts` | NEW | 定时清理 job |
| `packages/api-server/src/index.ts` | MODIFY | 启动时调用 startLogCleanup() |

---

## 4. 测试要求

| 测试 | 类型 | 文件 |
|------|------|------|
| LogService.writeLog 写入 DB | 单元 | `core/__tests__/services/log.service.test.ts` |
| LogService.writeLog app category 不写 DB | 单元 | 同上 |
| LogService.query 分页+过滤 | 单元 | 同上 |
| LogService.cleanup 删除过期 | 单元 | 同上 |
| withLogging 记录成功调用 | 单元 | `core/__tests__/services/with-logging.test.ts` |
| withLogging 记录失败调用 | 单元 | 同上 |
| Log API 查询端点 | 路由 | `api-server/__tests__/routes/logs.test.ts` |
| Log cleanup job 注册 | 单元 | `api-server/__tests__/jobs/log-cleanup.test.ts` |
