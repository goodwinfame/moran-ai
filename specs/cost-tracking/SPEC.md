# Phase 7: Cost Tracking System — SPEC

> **设计文档**：`docs/v2-s11-technical-architecture.md` §10（D14）
> **UI 文档**：`docs/v2-s4-ui-design.md` §7 Token 消耗, §11.5 Token 弹窗

---

## 1. 概述

追踪每次 LLM 调用的 Token 用量和费用，支持按 project/agent/model/时间聚合分析。
数据源：API Server 已订阅 OpenCode SSE 事件流，在 EventTransformer 中提取 usage。

---

## 2. 验收标准

### AC-7.1: DB Schema

- [ ] `usage_records` 表存在（`packages/core/src/db/schema/usage.ts`）
- [ ] 字段：id, projectId, userId, sessionId, agentName, toolName, model, promptTokens, completionTokens, totalTokens, estimatedCostUsd, createdAt
- [ ] 索引：(project_id, created_at DESC), (user_id, created_at DESC)
- [ ] `packages/core/src/db/schema/index.ts` 导出此表
- [ ] Drizzle migration 生成并可执行

### AC-7.2: MODEL_PRICING 配置

- [ ] `packages/core/src/services/cost.config.ts` 存在
- [ ] 包含 `MODEL_PRICING` 对象：每个模型的 input/output 单价（美元/百万 Token）
- [ ] 至少包含：claude-sonnet-4, claude-opus-4, gpt-4o, kimi-k2, gemma-4
- [ ] 导出 `calculateCost(model, promptTokens, completionTokens): number` 函数

### AC-7.3: CostService

- [ ] `packages/core/src/services/cost.service.ts` 存在
- [ ] `recordUsage(data)`: 写入 usage_records（计算 estimatedCostUsd 后写入）
- [ ] `getSummary({ projectId, from?, to? })`: 返回聚合数据
  - totalTokens, totalCostUsd
  - byAgent: `{ [agentName]: { tokens, cost } }`
  - byModel: `{ [model]: { tokens, cost } }`
  - dailyTrend: `[{ date, tokens, cost }]`
- [ ] `getDetails({ projectId, limit?, offset?, agentName?, model? })`: 分页查询明细
- [ ] 导出在 `packages/core/src/services/index.ts`

### AC-7.4: Usage API 端点

- [ ] `GET /api/projects/:id/usage/summary` — 返回聚合摘要
  - 支持 `?from=&to=` 查询参数（ISO 日期）
- [ ] `GET /api/projects/:id/usage/details` — 返回分页明细
  - 支持 `?limit=&offset=&agentName=&model=` 查询参数
- [ ] 路由挂载在 `packages/api-server/src/app.ts`
- [ ] 需 `requireAuth` 中间件

### AC-7.5: EventTransformer Token 提取

- [ ] 修改 `packages/api-server/src/sse/transformer.ts`
- [ ] 从 `message.completed` 事件中提取 `usage` 字段
- [ ] 调用 `CostService.recordUsage()` 异步写入 DB
- [ ] 写入失败不影响事件流（catch + log）

### AC-7.6: NavBar Token 展示

- [ ] `ChatNavBar.tsx` 中 "0 Token" 改为真实数据
- [ ] 调 `GET /api/projects/:id/usage/summary` 获取 totalTokens
- [ ] 格式化显示（如 "12.3K Token"、"1.2M Token"）

### AC-7.7: Token 消耗弹窗

- [ ] 点击 NavBar Token 区域弹出详情 Popover 或 Modal
- [ ] 展示：总 Token、总费用（USD）、按 Agent 分布、按模型分布
- [ ] 使用 shadcn/ui Popover 或 Dialog

---

## 3. 修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/core/src/db/schema/usage.ts` | NEW | usage_records 表 |
| `packages/core/src/db/schema/index.ts` | MODIFY | 添加 export |
| `packages/core/src/services/cost.config.ts` | NEW | MODEL_PRICING + calculateCost |
| `packages/core/src/services/cost.service.ts` | NEW | recordUsage + getSummary + getDetails |
| `packages/core/src/services/index.ts` | MODIFY | 添加 export |
| `packages/api-server/src/routes/usage.ts` | NEW | Usage API 路由 |
| `packages/api-server/src/app.ts` | MODIFY | 挂载 usage 路由 |
| `packages/api-server/src/sse/transformer.ts` | MODIFY | 添加 usage 提取逻辑 |
| `packages/web/src/components/chat/ChatNavBar.tsx` | MODIFY | 真实 token 数据 |
| `packages/web/src/components/chat/TokenPopover.tsx` | NEW | Token 详情弹窗 |

---

## 4. 测试要求

| 测试 | 类型 | 文件 |
|------|------|------|
| calculateCost 计算正确性 | 单元 | `core/__tests__/services/cost.config.test.ts` |
| CostService.recordUsage 写入 | 单元 | `core/__tests__/services/cost.service.test.ts` |
| CostService.getSummary 聚合 | 单元 | 同上 |
| CostService.getDetails 分页 | 单元 | 同上 |
| Usage API summary 端点 | 路由 | `api-server/__tests__/routes/usage.test.ts` |
| Usage API details 端点 | 路由 | 同上 |
| EventTransformer usage 提取 | 单元 | 更新现有 transformer 测试 |
| ChatNavBar 真实 token 显示 | 组件 | 更新现有 ChatNavBar 测试 |
| TokenPopover 渲染 | 组件 | `web/__tests__/components/chat/TokenPopover.test.tsx` |
