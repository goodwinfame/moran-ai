# V2 实施总计划 — Implementation Master Plan

> **角色**：本文件是实施阶段的 Single Source of Truth，任何新 session 都应首先阅读本文件。
> **优先级**：AGENTS.md（项目宪法）> 本文件（实施计划）> 各模块 TASKS.md（模块任务）
> **更新规则**：每完成一个 Phase 或关键任务后，更新本文件状态标记。

---

## 快速恢复指南（新 Session 必读）

1. 读 `AGENTS.md` — 项目总宪，了解架构、约束、Agent 体系
2. 读本文件 — 了解当前进度，找到"下一步"
3. 读当前 Phase 对应的模块 `TASKS.md` — 了解具体任务细节
4. `git log --oneline -10` — 确认最新 commit 状态
5. 开始工作

---

## 项目概况

- **分支**：`v2-rewrite`
- **Git 身份**：`goodwinfame <swim1986@126.com>`（每次 commit 必须设置环境变量）
- **Commit 风格**：英文，语义化（feat: / fix: / chore: / docs:）
- **平台**：Windows PowerShell

---

## Phase 0：前置准备 ✅ 已完成

| 任务 | 状态 | Commit |
|------|------|--------|
| V2 设计文档（12 篇） | ✅ | 多个 commit |
| SDD 基础设施（specs/ 目录） | ✅ | — |
| 10 个模块 Spec 编写（SPEC + DESIGN + TASKS） | ✅ | — |
| 工具名/别名全局清理 | ✅ | `1e85ae3` |
| 8 项架构变更传播 | ✅ | `6d50487` |
| 一致性审查修复（DB unique + config + refs） | ✅ | `5e1e962` |
| Per-spec 审查修复（gate + event + auth + mcp-tools） | ✅ | `5b487fe` |
| 题材技法管理设计落地（knowledgeSourceEnum） | ✅ | `a14c9d2` |
| 文档一致性修复（v2-s2 server→api-server） | ✅ | 待 commit |
| V1 代码清理 | ⏳ 待执行 | — |

### V1 代码清理（Phase 0 最后一步）

**目标**：删除 V2 不再使用的代码，保留基础设施。

**保留**：
- `packages/core/src/db/` — Schema 是 V2 基础
- `packages/core/src/events/` — EventBus 复用
- `packages/core/src/logger/` — 日志工具复用
- `packages/core/src/types/` — 部分类型复用
- 构建配置（tsconfig, package.json, pnpm-workspace.yaml）
- Docker 配置（docker-compose.dev.yml）
- 测试框架配置（vitest）

**删除/清空**：
- `packages/agents/` — V2 Agent 配置在 `agents/*.md`
- V1 的 engine/bridge/orchestrator 代码（如存在）
- V1 前端组件（需评估哪些可复用）

**注意**：清理前先检查各包的 `package.json exports`，确保不破坏跨包引用。

---

## Phase 1：基础层（无外部依赖）

**目标**：DB schema 对齐 V2 spec + 认证系统 + 基础设施就绪

### 1.1 database — Schema Migration

**Spec 文件**：`specs/database/SPEC.md` + `DESIGN.md` + `TASKS.md`

| 任务 | 详情 | 验收 |
|------|------|------|
| `characterRoleEnum` 加 `deuteragonist` | 5 值 → 完整叙事角色体系 | enum 包含 5 值 |
| `projectStatusEnum` 改为 6 阶段 | 对齐 MCP 门禁 | 值为 brainstorm/world/character/outline/writing/completed |
| `characters` 表加 `wound` + `design_tier` | 五维心理模型 + 设计深度 | 字段存在，nullable |
| 生成 Drizzle migration | `drizzle-kit generate` | migration 文件存在 |
| 验证 | `pnpm typecheck` + `pnpm test` | 零错误 |

### 1.2 infrastructure — Docker + 连接

**Spec 文件**：`specs/infrastructure/SPEC.md` + `DESIGN.md` + `TASKS.md`

| 任务 | 详情 | 验收 |
|------|------|------|
| 确认 Docker Compose | postgres + opencode 容器配置 | `docker compose up` 成功 |
| 惰性连接 `getDb()` | 确认不破坏 | 不阻塞模块顶层 |
| 环境变量模板 | `.env.example` | 包含 DATABASE_URL, API_UPSTREAM 等 |

### 1.3 auth — 认证系统

**Spec 文件**：`specs/auth/SPEC.md` + `DESIGN.md` + `TASKS.md`

| 任务 | 详情 | 验收 |
|------|------|------|
| `users` 表 + Drizzle schema | email, password_hash, created_at | migration 存在 |
| `sessions` 表 | token, user_id, expires_at | migration 存在 |
| 注册/登录 API | `POST /api/auth/register`, `POST /api/auth/login` | 返回 session cookie |
| `requireAuth` 中间件 | Hono middleware，校验 session cookie | 未认证返回 401 |
| 密码哈希 | bcrypt/argon2 | 不明文存储 |
| 测试 | 注册→登录→访问受保护路由→登出 | 全部通过 |

### Phase 1 测试策略

```bash
pnpm typecheck                    # 类型检查
pnpm --filter @moran/core test    # core 包单元测试
pnpm --filter @moran/api-server test  # API 路由测试（createApp + app.request）
```

---

## Phase 2：Service 层 ✅ 已完成

**目标**：所有业务逻辑抽象为 Service，被 MCP 工具和 API 路由共用

**Spec 文件**：Service 层分散在各模块 DESIGN.md 中，核心设计在 `docs/v2-s11-technical-architecture.md`

**完成状态**：14 个 CRUD Service 已实现 + 226 个测试全部通过。Commit `846719d`。
剩余 5 个复杂 Service（ReviewService, AnalysisService, ContextService, CostService, LogService）因依赖外部系统或复杂聚合逻辑，延后到 Phase 3/4 按需实现。

### Service 清单

Service 统一放置在 `packages/core/src/services/`：

| Service | 文件 | 职责 | 被调用方 |
|---------|------|------|---------|
| ProjectService | `project.ts` | 项目 CRUD | MCP + API |
| BrainstormService | `brainstorm.ts` | 创意简报 CRUD + patch | MCP + API |
| WorldService | `world.ts` | 世界设定 CRUD + check + patch | MCP + API |
| CharacterService | `character.ts` | 角色 CRUD + patch + 状态快照 | MCP + API |
| RelationshipService | `relationship.ts` | 角色关系 CRU | MCP + API |
| StyleService | `style.ts` | 文风配置 CRU | MCP + API |
| OutlineService | `outline.ts` | 大纲 CRUD + patch | MCP + API |
| ChapterService | `chapter.ts` | 章节 CRUD + archive + patch | MCP + API |
| ReviewService | `review.ts` | 审校执行 + 结论合成 | MCP |
| SummaryService | `summary.ts` | 章节/弧段摘要 CR | MCP |
| ThreadService | `thread.ts` | 伏笔追踪 CRU | MCP |
| TimelineService | `timeline.ts` | 时间线 CR | MCP |
| KnowledgeService | `knowledge.ts` | 知识库 CRUD + patch | MCP + API |
| LessonService | `lesson.ts` | 写作教训 CRU | MCP |
| AnalysisService | `analysis.ts` | 九维分析 | MCP |
| ContextService | `context.ts` | context_assemble（write/revise/rewrite 三模式） | MCP |
| GateService | `gate.ts` | 门禁检查 | MCP |
| CostService | `cost.ts` | 成本追踪（token 用量 + 费用聚合） | MCP + API |
| LogService | `log.ts` | 结构化日志持久化 | 全局 |

### Service 设计模式

```typescript
// 统一模式：每个 Service 是纯函数集合，接收 db 实例
import { getDb } from "../db/index.js";

export async function createProject(data: CreateProjectInput) {
  const db = getDb();
  // ... Drizzle 操作
}
```

### Phase 2 测试策略

每个 Service 对应 `packages/core/__tests__/services/{name}.test.ts`。
测试使用内存 DB 或 test container。

```bash
pnpm --filter @moran/core test
```

---

## Phase 3：AI 集成层

**目标**：MCP Server + 54 工具 + 10 Agent 配置 + 门禁系统 + 种子数据

### 3.1 mcp-tools — MCP Server + 54 工具

**Spec 文件**：`specs/mcp-tools/SPEC.md` + `DESIGN.md` + `TASKS.md`

| 任务组 | 数量 | 说明 |
|--------|------|------|
| MCP Server 骨架 | 1 | `packages/mcp-server/` 初始化，stdio 传输 |
| GateChecker 核心类 | 1 | HARD 拒绝 / SOFT 警告 |
| 18 域 54 工具实现 | 54 | 每个工具 = schema + handler + gate check + Service 调用 |
| 门禁规则定义 | 1 | 覆盖 SPEC 中所有 HARD/SOFT 规则 |
| Patch 工具 | ~10 | find/replace 语义的独立 patch 方法 |

**工具文件组织**（按域分文件）：
```
packages/mcp-server/src/tools/
  project.ts      # project_read, project_update
  gate.ts         # gate_check
  brainstorm.ts   # brainstorm_create/read/update/patch
  world.ts        # world_create/read/update/delete/check/patch
  character.ts    # character_create/read/update/delete/patch
  ...             # 每个域一个文件
```

### 3.2 agents — Agent 配置 + 种子数据

**Spec 文件**：`specs/agents/SPEC.md` + `DESIGN.md` + `TASKS.md`

| 任务 | 说明 |
|------|------|
| T2: 10 个 Agent Markdown | `agents/*.md`，frontmatter + system prompt |
| T3: 9 个风格种子 | `packages/core/src/db/seed/styles.ts` |
| T3.5: 题材技法种子 | `packages/core/src/db/seed/genre-knowledge.ts` |
| T4: opencode.json | MCP 连接配置 |

### 3.3 opencode-integration

**Spec 文件**：`specs/opencode-integration/SPEC.md` + `DESIGN.md` + `TASKS.md`

| 任务 | 说明 |
|------|------|
| Docker 挂载 | agents/, opencode.json, mcp-server/ |
| Session 管理 | userId + projectId → sessionId 映射 |
| 模型覆盖优先级 | resolveModel()：项目级 > 全局 > 风格默认 > Agent 默认 |
| 温度场景化 | resolveTemperature()：5 种章节类型 |

### Phase 3 测试策略

```bash
# MCP 工具单元测试（mock DB）
pnpm --filter @moran/mcp-server test

# 集成测试（真实 DB + MCP Server）
pnpm --filter @moran/mcp-server test:integration

# 门禁规则测试
# 每条 HARD 规则至少 2 个用例：拒绝 + 通过
```

---

## Phase 4：API 层

**目标**：Hono REST API + SSE 实时推送

### 4.1 api-routes

**Spec 文件**：`specs/api-routes/SPEC.md` + `DESIGN.md` + `TASKS.md`

| 路由组 | 端点数 | 说明 |
|--------|--------|------|
| Auth | ~4 | register, login, logout, me |
| Projects | ~3 | list, get, update |
| Chat | ~3 | send message, get history, get session |
| Panel data | ~15 | 各 Tab 数据读取（brainstorm, world, characters, outline, chapters, reviews, analysis, knowledge） |

### 4.2 sse-realtime

**Spec 文件**：`specs/sse-realtime/SPEC.md` + `DESIGN.md` + `TASKS.md`

| 任务 | 说明 |
|------|------|
| SSE endpoint | `GET /api/projects/:id/events/subscribe` |
| Agent 状态事件 | agent.started / thinking / completed / error |
| 面板更新事件 | panel.update（Tab 数据变更通知） |
| 操作保护期 | 10 秒内不自动切换 Tab |

### Phase 4 测试策略

```bash
# API 路由测试（createApp + app.request，不启动 HTTP）
pnpm --filter @moran/api-server test

# SSE 测试（EventSource mock）
pnpm --filter @moran/api-server test:sse
```

---

## Phase 5：前端

**目标**：2 个页面 + 聊天窗口 + 信息面板（8 Tab）

### 5.1 project-list

**Spec 文件**：`specs/project-list/SPEC.md` + `DESIGN.md` + `TASKS.md`

| 任务 | 说明 |
|------|------|
| 项目列表页 `/` | 卡片网格，创建/删除/进入 |
| Zustand store | projects store |

### 5.2 chat-ui

**Spec 文件**：`specs/chat-ui/SPEC.md` + `DESIGN.md` + `TASKS.md`

| 任务 | 说明 |
|------|------|
| 聊天窗口组件 | 消息列表 + 输入框 + Markdown 渲染 |
| Agent 状态条 | 输入框上方，SSE 驱动 |
| 会话抽屉 | 点击状态条展开，查看子 Agent 工作过程 |
| Question Panel | 决策建议替换输入框 |

### 5.3 info-panel

**Spec 文件**：`specs/info-panel/SPEC.md` + `DESIGN.md` + `TASKS.md`

| Tab | 数据源 |
|-----|--------|
| 脑暴 | brainstorm API |
| 设定 | world API |
| 角色 | character + relationship API |
| 大纲 | outline API |
| 章节 | chapter API（流式渲染写作过程） |
| 审校 | review API |
| 分析 | analysis API |
| 知识库 | knowledge + lesson API |

### Phase 5 测试策略

```bash
# 组件测试（Vitest + Testing Library）
pnpm --filter @moran/web test

# E2E 测试（Playwright）
pnpm --filter @moran/web test:e2e
```

---

## Phase 6：Wiring & Auth Foundation（P0 阻塞）

**目标**：修复所有数据流断裂 + 补齐认证 UI，使系统端到端跑通

**Spec 文件**：`specs/wiring-auth/SPEC.md`

| 任务 | 说明 | 严重程度 |
|------|------|---------|
| 6.1 SSE 前端自动连接 | WorkspacePage mount 时调用 `useSSEStore.connect()` | 🔴 P0 |
| 6.2 面板数据初始加载 | InfoPanel 打开 Tab 时从 API 拉取数据，不仅读 IndexedDB | 🔴 P0 |
| 6.3 Next.js Auth 中间件 | `middleware.ts` 校验 cookie，未认证重定向 `/login` | 🟡 P1 |
| 6.4 Login 页面 | `/login` 路由 + 表单 + 调用 `POST /api/auth/login` | 🟡 P1 |
| 6.5 Register 页面 | `/register` 路由 + 表单 + 调用 `POST /api/auth/register` | 🟡 P1 |

---

## Phase 7：Cost Tracking System（S11 §10）

**目标**：从 OpenCode SSE 事件中提取 token 用量，持久化到 DB，前端展示

**Spec 文件**：`specs/cost-tracking/SPEC.md`

| 任务 | 说明 |
|------|------|
| 7.1 `usage_records` DB 表 | model, prompt_tokens, completion_tokens, cost_usd, agent_id, session_id |
| 7.2 MODEL_PRICING 配置 | 各模型单价表（可运行时更新） |
| 7.3 CostService | 记录用量 + 按项目/时间/Agent 聚合查询 |
| 7.4 Usage API 端点 | `GET /api/projects/:id/usage/summary` + `GET /api/projects/:id/usage/details` |
| 7.5 EventTransformer token 提取 | 从 `message.completed` 事件中提取 usage 数据写入 DB |
| 7.6 NavBar Token 展示 | 将硬编码 "0 Token" 改为真实数据 |
| 7.7 Token 消耗弹窗 | 点击 Token 展示详细报表 modal |

---

## Phase 8：Logging System（S11 §11）

**目标**：结构化 Agent 日志持久化 + 查询 API + 自动清理

**Spec 文件**：`specs/logging/SPEC.md`

| 任务 | 说明 |
|------|------|
| 8.1 `agent_logs` DB 表 | level, agent_id, action, message, metadata, duration_ms |
| 8.2 LogService | 写入 DB + 按项目/Agent/级别查询 + 聚合统计 |
| 8.3 `withLogging` 装饰器 | Service 层方法自动记录入参/出参/耗时 |
| 8.4 Log 查询 API | `GET /api/projects/:id/logs` + 过滤/分页 |
| 8.5 Log 清理 Job | 90 天自动清理过期日志 |

---

## Phase 9：Settings Panel（S4 §11.1）

**目标**：Settings Drawer 从硬编码改为真实数据绑定

**Spec 文件**：`specs/settings/SPEC.md`

| 任务 | 说明 |
|------|------|
| 9.1 Settings Zustand Store | 读取/缓存/提交项目设置 |
| 9.2 Settings API 端点 | `PATCH /api/projects/:id/settings`（写风格、模型、预算、写作参数） |
| 9.3 ProjectSettingsDrawer 数据绑定 | 6 个区域全部接入真实 store + API |

---

## Phase 10：UI Integration & Export

**目标**：补齐 UI 组件 wiring + Export 后端

**Spec 文件**：`specs/ui-integration/SPEC.md`

| 任务 | 说明 |
|------|------|
| 10.1 Wire AgentStatusBar | ChatPanel 中接入 AgentStatusBar + AgentDrawer |
| 10.2 Wire QuickActions | ChatPanel 中接入 QuickActions 组件 |
| 10.3 Wire FileUploadDialog | ChatInput 📎 按钮接入 FileUploadDialog |
| 10.4 Export 后端 | `POST /api/projects/:id/export` + ExportService（TXT/MD/DOCX） |
| 10.5 Export 前端对接 | ExportDialog 调用真实 API 下载文件 |

---

## 跨 Phase 约束

### 代码规范（AGENTS.md §9 强制）
- ❌ `as any` / `@ts-ignore` / `@ts-expect-error`
- ❌ Next.js 写业务 API
- ❌ 阻塞模块顶层 await
- ❌ 直接调 LLM Provider（必须 OpenCode SDK）
- ❌ 依赖反转（core ← web/api-server ✅，core → web/api-server ❌）

### 测试基线
- 每个 Phase 完成后：`pnpm typecheck` + `pnpm test` 全部通过
- 新功能必须有测试
- 测试文件位置：`packages/{pkg}/__tests__/`

### Git 规范
```powershell
# 每次 commit 必须设置身份
$env:GIT_AUTHOR_NAME='goodwinfame'
$env:GIT_AUTHOR_EMAIL='swim1986@126.com'
$env:GIT_COMMITTER_NAME='goodwinfame'
$env:GIT_COMMITTER_EMAIL='swim1986@126.com'
```

### 关键架构决策（D1-D15）
详见 `docs/v2-s11-technical-architecture.md`。摘要：
- D1: MCP 传输 = stdio
- D6: 写入双入口（Agent→MCP→Service→DB + 用户→API→Service→DB）
- D10: 认证 = 邮箱密码 + Session Cookie
- D12: Service 层 = `packages/core/src/services/`
- D13: Patch = 独立工具，find/replace 语义

---

## 文件索引（快速导航）

| 文件 | 用途 |
|------|------|
| `AGENTS.md` | 项目总宪 |
| `specs/IMPLEMENTATION-PLAN.md` | 本文件：实施总计划 |
| `specs/{module}/SPEC.md` | 模块功能规范 |
| `specs/{module}/DESIGN.md` | 模块技术方案 |
| `specs/{module}/TASKS.md` | 模块任务列表 |
| `docs/v2-s11-technical-architecture.md` | 技术架构决策 |
| `docs/v2-s4-ui-design.md` | UI 交互设计 |
| `docs/v2-s6-mcp-gates.md` | MCP 工具定义 |

---

## 进度追踪

> 每完成一个任务，将 ⏳ 改为 ✅ 并注明 commit hash。

| Phase | 任务 | 状态 | Commit |
|-------|------|------|--------|
| 0 | 设计文档 + Spec 编写 | ✅ | 多个 |
| 0 | 工具名/别名清理 | ✅ | `1e85ae3` |
| 0 | 架构变更传播 | ✅ | `6d50487` |
| 0 | 一致性审查修复 | ✅ | `5e1e962` |
| 0 | Per-spec 审查修复 | ✅ | `5b487fe` |
| 0 | 题材技法管理设计 | ✅ | `a14c9d2` |
| 0 | 文档一致性修复 | ✅ | `eb7a191` |
| 0 | V1 代码清理 | ✅ | `2bbfc52` |
| 1.1 | database schema migration | ✅ | `dbf9da2` |
| 1.2 | infrastructure Docker + 连接 | ✅ | `3c28b63` |
| 1.3 | auth 认证系统 | ✅ | `8910f44` |
| 2 | Service 层（14 CRUD Service, 226 tests） | ✅ | `846719d` |
| 3.1 | MCP Server + 54 工具 + 303 tests | ✅ | `40f30cc` |
| 3.2 | Agent 配置 + 种子数据 + MCP 连接配置 | ✅ | `78918db` |
| 3.3 | OpenCode 集成配置（Session Manager + Docker mounts, 548 tests） | ✅ | `3453b55` |
| 4.1 | API 路由（20 endpoints, 77 tests, 625 total） | ✅ | `7b12ae5` |
| 4.2 | SSE 实时推送（14 event types, server+frontend, 127 tests, 751 total） | ✅ | `58c2637` |
| 5.1 | 项目列表页（7 components, store, shared, shadcn, 90 tests, 841 total） | ✅ | `2842dae` |
| 5.2 | 聊天窗口（18 components, chat-store, 123 tests, 964 total） | ✅ | `e46c32a` |
| 5.3 | 信息面板（8 tabs, panel-store, event routing, 22 tests, 1061 total） | ✅ | `aece634` |
| 6.1 | SSE 前端自动连接 | ⏳ | — |
| 6.2 | 面板数据初始加载 | ⏳ | — |
| 6.3 | Next.js Auth 中间件 | ⏳ | — |
| 6.4 | Login 页面 | ⏳ | — |
| 6.5 | Register 页面 | ⏳ | — |
| 7.1-7.7 | Cost Tracking System | ⏳ | — |
| 8.1-8.5 | Logging System | ⏳ | — |
| 9.1-9.3 | Settings Panel | ⏳ | — |
| 10.1-10.5 | UI Integration & Export | ⏳ | — |
