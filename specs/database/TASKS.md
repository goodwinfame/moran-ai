# database — TASKS

> **模块**：database

## 任务列表

### T1: 修改 characterRoleEnum 加 deuteragonist
- **输入**：`packages/core/src/db/schema/enums.ts`
- **输出**：枚举值包含 `["protagonist", "deuteragonist", "antagonist", "supporting", "minor"]`
- **验收**：`pnpm typecheck` 通过，schema 定义正确

### T2: 替换 projectStatusEnum 为 6 态
- **输入**：`packages/core/src/db/schema/enums.ts`
- **输出**：枚举值为 `["brainstorm", "world", "character", "outline", "writing", "completed"]`
- **验收**：`pnpm typecheck` 通过，schema 定义正确

### T3: characters 表新增 wound 和 design_tier 字段
- **输入**：`packages/core/src/db/schema/characters.ts`
- **输出**：`wound` (text, nullable) + `design_tier` (text, nullable) 两个字段
- **验收**：`pnpm typecheck` 通过

### T4: projects 表 status 默认值改为 brainstorm
- **输入**：`packages/core/src/db/schema/projects.ts`
- **输出**：`.default("brainstorm")`
- **验收**：schema 默认值正确

### T5: 生成 Drizzle Migration
- **输入**：T1-T4 的 schema 变更
- **输出**：`packages/core/drizzle/` 下新 migration 文件
- **操作**：
  1. `drizzle-kit generate` 尝试自动生成
  2. 检查枚举替换部分，手写修正 `projectStatusEnum` 的替换 SQL
  3. 验证 migration 文件语法正确
- **验收**：migration 文件存在，SQL 语法正确

### T6: 应用 Migration 并验证
- **输入**：T5 的 migration 文件
- **输出**：本地 PostgreSQL 数据库更新完成
- **操作**：
  1. `drizzle-kit migrate` 应用
  2. `SELECT enum_range(NULL::project_status)` 验证枚举
  3. `SELECT enum_range(NULL::character_role)` 验证枚举
  4. `\d characters` 验证新字段
- **验收**：数据库实际结构与 schema 一致

### T7: 验证全局构建
- **输入**：T1-T6 完成后的代码库
- **输出**：`pnpm typecheck` + `pnpm test` 全部通过
- **验收**：零错误

## 依赖关系

```
T1 ─┐
T2 ─┤
T3 ─┼─→ T5 → T6 → T7
T4 ─┘
```

T1-T4 可并行（纯 schema 修改），T5 依赖全部 schema 变更，T6 依赖 T5，T7 最终验证。
