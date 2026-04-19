# database — DESIGN

> **状态**：已完成
> **模块**：database

## 1. 当前状态

V1 数据库共 20 个 schema 文件（19 张表 + 1 个枚举文件），全部在 `packages/core/src/db/schema/` 下。
V2 做增量修改，不重建。

| 组件 | 状态 | V2 改动 |
|------|------|---------|
| `enums.ts` | ⚠️ 需修改 | `characterRoleEnum` 加 `deuteragonist`；`projectStatusEnum` 重定义为 6 态 |
| `characters.ts` | ⚠️ 需修改 | `characters` 表新增 `wound`, `design_tier` 字段 |
| `character_dna` 表 | ✅ 无需改 | 已有完整五维（ghost, wound, lie, want, need） |
| 其余 17 张表 | ✅ 无需改 | 保持原样 |
| Drizzle 配置 | ✅ 可用 | `drizzle.config.ts` 已就绪 |

## 2. 技术方案

### 2.1 枚举修改策略

PostgreSQL 枚举修改比较特殊——`ALTER TYPE ... ADD VALUE` 可以加值，但 **不能删值**。
`characterRoleEnum` 只需加值，直接 `ADD VALUE`。
`projectStatusEnum` 需要从 8 态变 6 态——值集合完全不同，必须用 **替换策略**。

#### characterRoleEnum（加值）

```sql
ALTER TYPE "character_role" ADD VALUE IF NOT EXISTS 'deuteragonist';
```

Drizzle schema 修改：
```typescript
export const characterRoleEnum = pgEnum("character_role", [
  "protagonist", "deuteragonist", "antagonist", "supporting", "minor"
]);
```

#### projectStatusEnum（替换）

PostgreSQL 不支持删除枚举值，需要：
1. 创建新类型 `project_status_v2`
2. 修改列类型从旧类型到新类型（`ALTER COLUMN ... TYPE ... USING`）
3. 删除旧类型
4. 重命名新类型为 `project_status`

```sql
-- 创建新枚举
CREATE TYPE "project_status_v2" AS ENUM ('brainstorm', 'world', 'character', 'outline', 'writing', 'completed');

-- 映射旧值到新值
ALTER TABLE "projects" ALTER COLUMN "status" TYPE "project_status_v2"
  USING CASE
    WHEN "status"::text = 'planning' THEN 'brainstorm'
    WHEN "status"::text = 'intent' THEN 'brainstorm'
    WHEN "status"::text = 'world' THEN 'world'
    WHEN "status"::text = 'characters' THEN 'character'
    WHEN "status"::text = 'style' THEN 'outline'
    WHEN "status"::text = 'outline' THEN 'outline'
    WHEN "status"::text = 'ready' THEN 'writing'
    WHEN "status"::text = 'active' THEN 'writing'
    ELSE 'brainstorm'
  END::"project_status_v2";

-- 替换类型名
DROP TYPE "project_status";
ALTER TYPE "project_status_v2" RENAME TO "project_status";
```

Drizzle schema 修改：
```typescript
export const projectStatusEnum = pgEnum("project_status", [
  "brainstorm", "world", "character", "outline", "writing", "completed"
]);
```

**注意**：Drizzle Kit 的 `generate` 可能无法自动生成枚举替换 SQL。需要手写 migration 文件，或生成后手动修正。

### 2.2 characters 表新增字段

```typescript
// packages/core/src/db/schema/characters.ts — 新增字段
wound: text("wound"),                    // 心理伤痕摘要（五维模型第二维）
designTier: text("design_tier"),         // 设计深度：core / important / supporting / decorative
```

Migration SQL：
```sql
ALTER TABLE "characters" ADD COLUMN "wound" text;
ALTER TABLE "characters" ADD COLUMN "design_tier" text;
```

### 2.3 projects 表 default 值修改

`status` 列的默认值需从 `'planning'` 改为 `'brainstorm'`：

```typescript
status: projectStatusEnum("status").default("brainstorm"),
```

### 2.4 Migration 策略

1. 使用 `drizzle-kit generate` 尝试自动生成
2. 检查生成结果，手动修正枚举替换部分（如 Drizzle Kit 不支持枚举删值）
3. 使用 `drizzle-kit migrate` 应用到本地 PostgreSQL
4. 验证：`SELECT enum_range(NULL::project_status)` 确认枚举值正确

Migration 文件存放在 `packages/core/drizzle/` 目录。

### 2.5 类型导出

确保 `packages/core/src/db/schema/index.ts` 正确导出修改后的类型，
供 server 包的路由和 MCP 工具使用。

## 3. 不需要改动的部分

- 17 张未变更表的 schema 文件
- `character_dna` 表（已有 wound 字段）
- Drizzle 连接配置（惰性 `getDb()` 模式）
- 数据库容器配置（docker-compose.dev.yml）

## 4. 风险与注意事项

- **枚举替换需谨慎**：`projectStatusEnum` 替换涉及 `USING` 子句映射旧值，须确保所有旧值都有映射
- **不可逆操作**：枚举值一旦映射，旧值消失。建议在 migration 前备份数据库
- **Drizzle Kit 限制**：Drizzle Kit 对枚举变更支持有限，可能需要手写 SQL migration
