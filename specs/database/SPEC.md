# database — SPEC

> **状态**：已完成
> **模块**：database
> **最后更新**：2026-04-19

## 1. 概述

数据库模块定义 V2 的 PostgreSQL schema 演进。V2 在 V1 的 19 张表基础上做增量修改，不重建。
核心变更：补齐角色枚举缺失值、新增五维心理模型字段、对齐 MCP 门禁阶段枚举。

技术栈：Drizzle ORM + PostgreSQL 16，惰性连接模式（`getDb()`）。

## 2. 功能需求

### 2.1 枚举修改

#### `characterRoleEnum` 新增 `deuteragonist`

当前值：`["protagonist", "antagonist", "supporting", "minor"]`
目标值：`["protagonist", "deuteragonist", "antagonist", "supporting", "minor"]`

理由：V2 双维度角色分类体系需要区分"第二主角"（拥有独立弧光的双主角/CP）。

#### `projectStatusEnum` 对齐 MCP 门禁阶段

当前值：`["planning", "intent", "world", "characters", "style", "outline", "ready", "active"]`
目标值：`["brainstorm", "world", "character", "outline", "writing", "completed"]`

理由：V2 门禁机制（v2-s6）定义了 6 个阶段，`project_read` 返回的 `phase` 字段必须与门禁一致。V1 的 8 态过细且与实际创作流程不符。

### 2.2 表结构修改

#### `characters` 表新增字段

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `wound` | `text` | nullable | 心理伤痕（五维心理模型第二维，GHOST 与 LIE 的桥梁） |
| `design_tier` | `text` | nullable | 设计深度层级：`core / important / supporting / decorative` |

说明：
- `wound` 字段补齐五维模型（GHOST → **WOUND** → LIE → WANT → NEED）。`character_dna` 表已有 `wound` 字段，但 `characters` 主表缺少，需要在主表也存储摘要版本供列表展示。
- `design_tier` 用于 UI 按设计深度分组展示角色卡片（核心层/重要层/支撑层/点缀层）。

#### `character_dna` 表

`character_dna` 已包含完整五维字段（ghost, wound, lie, want, need），无需修改。确认保留。

### 2.3 保留的 19 张表

以下表全部保留，不删除不重建：

| 表名 | 用途 | V2 变更 |
|------|------|---------|
| `projects` | 项目基本信息 | 无 |
| `chapters` | 章节内容 | 无 |
| `characters` | 角色档案 | 新增 wound, design_tier |
| `character_states` | 角色章节状态快照 | 无 |
| `character_dna` | 角色五维心理模型 | 无（已有 wound） |
| `relationships` | 角色关系 | 无 |
| `world` | 世界观设定 | 无 |
| `locations` | 地点信息 | 无 |
| `factions` | 势力组织 | 无 |
| `glossary` | 术语表 | 无 |
| `outline` | 大纲（弧段+章节详案） | 无 |
| `memory` | 记忆系统 | 无 |
| `tension` | 张力追踪 | 无 |
| `documents` | 通用文档（脑暴/审校/分析报告） | 无 |
| `knowledge` | 知识库条目 | 无 |
| `logs` | 操作日志 | 无 |
| `summaries` | 章节摘要 | 无 |
| `relations` | 通用关系 | 无 |
| `styles` | 文风配置 | 无 |
| `lessons` | 写作教训 | 无 |

### 2.4 Drizzle Migration

- 使用 `drizzle-kit generate` 生成 migration SQL
- 使用 `drizzle-kit migrate` 应用到数据库
- migration 文件归档在 `packages/core/drizzle/` 目录

### 2.5 惰性连接

保持 V1 的惰性连接模式：`getDb()` 首次调用时建立连接，之后复用。
不在模块顶层 `await`，避免阻塞 Next.js 启动。

## 3. 验收标准

- [ ] `characterRoleEnum` 包含 `deuteragonist`
- [ ] `projectStatusEnum` 值为 `["brainstorm", "world", "character", "outline", "writing", "completed"]`
- [ ] `characters` 表包含 `wound` (text, nullable) 和 `design_tier` (text, nullable) 字段
- [ ] `character_dna` 表保持完整五维字段（ghost, wound, lie, want, need）
- [ ] Drizzle migration 文件已生成
- [ ] `pnpm typecheck` 通过（core 包零错误）
- [ ] 所有现有测试通过
- [ ] `getDb()` 惰性连接模式未被破坏

## 4. 依赖

- 依赖 `infrastructure` 模块（数据库容器正常运行）
- 被 `api-routes`、`opencode-integration` 依赖
