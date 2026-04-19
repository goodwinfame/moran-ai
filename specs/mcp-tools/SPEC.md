# MCP 工具设计规范

> **类型**：技术规格（Technical Specification）  
> **目的**：定义 MCP 工具的设计规范和约束，确保工具集的一致性和可维护性。  
> **受众**：实现 MCP 工具的开发者（人类或 AI Agent）。  
> **权威性**：工具设计必须遵守本规范。新增/修改工具前必须对照本文检查。

---

## 1. 术语定义

| 术语 | 定义 |
|------|------|
| **域（Domain）** | 一组语义关联的工具的命名空间。如 `character`、`world`、`chapter`。 |
| **动作（Action）** | 工具执行的操作类型。来自标准动词集。 |
| **门禁（Gate）** | 工具执行前的前置条件检查。基于 DB 查询，无内存状态。 |
| **CRUD 对称性** | 可写域必须有对应的 read 操作，确保写入的数据可被读回。 |

---

## 2. 命名规范

### 2.1 格式

```
{domain}_{action}
```

- **domain**：1–2 个英文小写单词，下划线分隔。标识数据域。
- **action**：1 个英文小写单词，来自标准动词集。

示例：`character_create`、`character_state_read`、`context_assemble`

### 2.2 标准动词集

| 动词 | 语义 | 使用场景 |
|------|------|----------|
| `create` | 创建新实体 | 首次写入 |
| `read` | 读取实体（单个或列表） | 查询 |
| `update` | 修改已有实体 | 变更 |
| `delete` | 删除实体（软删除） | 移除 |
| `check` | 验证/检查（只读，不修改数据） | 门禁检查、一致性检查 |
| `execute` | 执行复合操作（涉及多步骤/多表） | 审校、分析 |
| `assemble` | 从多数据源组装只读视图 | 上下文组装 |
| `archive` | 冻结实体状态（不可再修改） | 章节归档 |
| `patch` | 局部文本替换（find/replace 语义） | 审校后改段落、微调设定描述 |

### 2.3 禁止的动词

以下动词在旧设计中使用过，现已禁止：

| 禁止 | 替代为 | 原因 |
|------|--------|------|
| `write` | `create` | 与 `read/write` 的 IO 语义混淆 |
| `revise` | `update` | 非标准动词，`update` 已涵盖 |
| `learn` | `create` | 过于具象，`lesson_create` 足够清晰 |
| `run` | `execute` | `run` 过于口语化 |
| `snapshot` | `create` | `character_state_create` 语义更清晰 |
| `round1`–`round4` | `execute` + `round` 参数 | 参数化优于工具名膨胀 |

### 2.4 域命名规则

- 单一实体域：直接用实体名。如 `character`、`chapter`、`outline`。
- 子实体域：`{父实体}_{子实体}`。如 `character_state`。
- **不允许**：三级以上嵌套（如 ~~`character_state_history`~~）。
- 同一数据域的不同子类型用 `type` 参数区分，**不**拆成多个域。如 world 域用 `type: "setting" | "subsystem" | "location" | "glossary"` 而非 4 个独立域。

---

## 3. 输入 Schema 规范

### 3.1 通用规则

1. **第一参数始终是 `projectId: string`**：所有工具都在项目上下文内操作。
2. **Schema 使用 Zod v4**：MCP SDK 要求 Zod 作为输入校验。
3. **可选字段用 `.optional()`**：不用 `.nullable()`。
4. **枚举用 `z.enum([...])`**：不用 `z.string()` + 注释。
5. **ID 字段命名**：`{entity}Id`，如 `characterId`、`chapterId`。不用 `id`（歧义）。

### 3.2 读取工具的输入模式

读取工具统一支持两种模式——单个查询和列表查询：

```typescript
input: z.object({
  projectId: z.string(),
  // 单个查询：传 ID
  characterId: z.string().optional(),
  // 列表过滤：传过滤参数
  role: z.enum([...]).optional(),
  designDepth: z.enum([...]).optional(),
})
```

- 传 `{entity}Id` → 返回单个实体详情
- 不传 → 返回列表（可选过滤）

### 3.3 联合类型参数

当一个域包含多种子类型时，用 `type` 参数区分：

```typescript
// world_create
input: z.object({
  projectId: z.string(),
  type: z.enum(["setting", "subsystem", "location", "glossary"]),
  name: z.string(),
  content: z.string(),
  // 按 type 可选的字段
  section: z.enum(["base", "custom"]).optional(),       // type=setting 时
  connections: z.array(z.object({...})).optional(),      // type=location 时
  category: z.string().optional(),                       // type=glossary 时
})
```

### 3.4 JSON 字符串字段

复杂嵌套结构（如角色五维心理模型、审校报告）作为 **JSON 字符串** 传递，工具内部 `JSON.parse` + 校验：

```typescript
profile: z.string(),  // JSON：{ ghost, wound, lie, want, need, personality, ... }
```

理由：MCP 协议的 inputSchema 基于 JSON Schema，深层嵌套降低 LLM 填充准确率。扁平化输入 + 内部校验更可靠。

---

## 4. 输出 Schema 规范

### 4.1 统一响应格式

**所有工具**返回以下格式之一：

```typescript
// 成功
{ ok: true, data: T }

// 失败
{ ok: false, error: { code: ErrorCode, message: string, details?: object } }
```

### 4.2 错误码枚举

| 错误码 | 含义 | 典型场景 |
|--------|------|----------|
| `GATE_FAILED` | 门禁前置条件不满足 | 写大纲时世界设定不存在 |
| `NOT_FOUND` | 目标实体不存在 | 按 ID 查询无结果 |
| `CONFLICT` | 状态冲突 | 重复创建已存在的唯一实体 |
| `VALIDATION` | 输入校验失败 | 必填字段缺失、枚举值非法 |
| `INTERNAL` | 内部错误（DB 异常等） | 不应暴露给 Agent 的细节 |

### 4.3 门禁失败的详情

当 `code` 为 `GATE_FAILED` 时，`details` 包含结构化的门禁信息：

```typescript
{
  ok: false,
  error: {
    code: "GATE_FAILED",
    message: "无法开始写作第3章",
    details: {
      passed: ["大纲已存在", "文风已配置"],
      failed: ["章节Brief未定义"],
      suggestions: ["请先让匠心为第3章生成详案"]
    }
  }
}
```

### 4.4 创建操作的返回

创建操作的 `data` 始终包含新实体的 `id`：

```typescript
// character_create 返回
{ ok: true, data: { id: "chr_abc123" } }

// world_create 返回
{ ok: true, data: { id: "ws_def456", type: "setting" } }
```

### 4.5 MCP 协议包装

MCP 工具实际返回的是 `{ content: [{ type: "text", text: string }] }`。上述 JSON 格式是 `text` 字段的内容：

```typescript
export function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ ok: true, data }) }],
  };
}

export function fail(code: string, message: string, details?: object) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: { code, message, details } }) }],
  };
}
```

---

## 5. CRUD 对称性规则

### 5.1 核心原则

**可写域必须有 read 操作。** Agent 写入的数据必须能被自己或其他 Agent 读回。

### 5.2 对称性矩阵

域根据使用模式分为以下几类：

| 类型 | 要求的操作 | 适用域 |
|------|-----------|--------|
| **完整 CRUD** | create, read, update, delete | `world`、`character`、`knowledge` |
| **CRU（无删除）** | create, read, update | `brainstorm`、`style`、`outline`、`relationship`、`thread`、`lesson` |
| **CR（只增只读）** | create, read | `character_state`、`summary`、`timeline` |
| **只读** | read | `project`（写用 update） |
| **复合操作** | execute / assemble / check / archive | `gate`、`review`、`analysis`、`context`、`chapter`（archive） |

### 5.3 跨 Agent 共享域

以下域被多个 Agent 共享读写，对 CRUD 完整性要求更高：

| 域 | 写入 Agent | 读取 Agent |
|----|-----------|-----------|
| `character` | 匠心 | 执笔、载史、博闻 |
| `world` | 匠心 | 执笔、载史、博闻 |
| `outline` | 匠心 | 执笔、墨衡 |
| `style` | 执笔 | 墨衡、匠心 |
| `knowledge` | 博闻 | 执笔、析典、墨衡 |
| `thread` | 载史 | 执笔、博闻 |
| `chapter` | 执笔 | 明镜、载史、博闻、析典 |

---

## 6. 门禁规范

### 6.1 实现原则

1. **门禁在工具内部**——每个 MCP 工具在执行前先检查前置条件。
2. **不依赖外部状态机**——门禁逻辑全部基于 DB 查询，无内存状态。
3. **拒绝时说明原因**——让 Agent 知道缺什么，可以告知用户或自动补救。
4. **幂等性**——重复调用同一工具不产生副作用。

### 6.2 门禁级别

| 级别 | 含义 | 失败行为 |
|------|------|----------|
| **HARD** | 必须满足，否则操作无意义 | 拒绝 + 返回 `GATE_FAILED` |
| **SOFT** | 建议满足，但可以跳过 | 警告 + 仍然执行 |
| **INFO** | 提示性信息 | 执行 + 附带提示 |

### 6.3 读取工具免门禁

所有 `_read` 工具无门禁。Agent 必须能在任何阶段读取任何数据。

---

## 7. 工具域总览

当前工具集：**18 域 54 工具**。

| # | 域 | 工具数 | 动作列表 | 主要使用 Agent |
|---|---|---|---|---|
| 1 | `project` | 2 | read, update | 墨衡 |
| 2 | `gate` | 1 | check | 墨衡 |
| 3 | `brainstorm` | 4 | create, read, update, **patch** | 灵犀 |
| 4 | `world` | 6 | create, read, update, delete, check, **patch** | 匠心 |
| 5 | `character` | 5 | create, read, update, delete, **patch** | 匠心 |
| 6 | `character_state` | 2 | create, read | 载史, 执笔 |
| 7 | `relationship` | 3 | create, read, update | 匠心 |
| 8 | `style` | 3 | create, read, update | 执笔 |
| 9 | `outline` | 4 | create, read, update, **patch** | 匠心 |
| 10 | `chapter` | 5 | create, read, update, archive, **patch** | 执笔, 载史 |
| 11 | `review` | 1 | execute | 明镜 |
| 12 | `summary` | 2 | create, read | 载史 |
| 13 | `thread` | 3 | create, read, update | 载史 |
| 14 | `timeline` | 2 | create, read | 载史 |
| 15 | `knowledge` | 5 | create, read, update, delete, **patch** | 博闻, 析典 |
| 16 | `lesson` | 3 | create, read, update | 博闻, 墨衡 |
| 17 | `analysis` | 2 | execute, read | 析典 |
| 18 | `context` | 1 | assemble | 执笔 |
| | **合计** | **54** | | |

---

## 8. 新增工具 Checklist

新增或修改 MCP 工具时，逐项检查：

### 8.1 命名检查

- [ ] 工具名符合 `{domain}_{action}` 格式
- [ ] `action` 来自标准动词集（§2.2）
- [ ] 没有使用禁止动词（§2.3）
- [ ] 域名不超过 2 个单词
- [ ] 子类型用 `type` 参数而非新域（§2.4）

### 8.2 输入检查

- [ ] 第一参数是 `projectId: string`
- [ ] 使用 Zod v4 定义 Schema
- [ ] 可选字段用 `.optional()`，非 `.nullable()`
- [ ] 枚举用 `z.enum()`，非 `z.string()` + 注释
- [ ] ID 字段命名 `{entity}Id`

### 8.3 输出检查

- [ ] 成功返回 `{ ok: true, data: T }`
- [ ] 失败返回 `{ ok: false, error: { code, message } }`
- [ ] `code` 来自标准错误码枚举（§4.2）
- [ ] 创建操作 `data` 包含 `{ id: string }`
- [ ] MCP 包装使用 `ok()` / `fail()` 工具函数

### 8.4 CRUD 对称性检查

- [ ] 如果是新增写入工具，同域是否已有 `read`？
- [ ] 如果是新增域，已规划哪些操作？是否符合 §5.2 矩阵？
- [ ] 跨 Agent 共享域是否有完整 CRU(D)？

### 8.5 门禁检查

- [ ] 写入工具定义了门禁条件（或明确标注"无门禁"）
- [ ] 读取工具无门禁
- [ ] 门禁级别标注（HARD / SOFT / INFO）
- [ ] 门禁失败返回 `GATE_FAILED` + `details`

### 8.6 文档同步

- [ ] 工具接口已添加到 `docs/v2-s6-mcp-gates.md`
- [ ] 门禁依赖图已更新
- [ ] 工具域总览表已更新（本文件 §7）
- [ ] `docs/v2-s11-technical-architecture.md` §3 的文件结构/工具数如需更新

---

## 9. 实现文件组织规范

### 9.1 一域一文件

每个域的工具实现放在 `packages/mcp-server/src/tools/{domain}.ts` 中。域名直接作为文件名。

```
packages/mcp-server/src/tools/
├── index.ts             # registerAllTools(server) —— 导入并调用所有域注册函数
├── project.ts           # project_read, project_update, gate_check
├── brainstorm.ts        # brainstorm_create, brainstorm_read, brainstorm_update, brainstorm_patch
├── world.ts             # world_create, world_read, world_update, world_delete, world_check, world_patch
├── character.ts         # character_create, character_read, character_update, character_delete, character_patch
├── character-state.ts   # character_state_create, character_state_read
├── relationship.ts      # relationship_create, relationship_read, relationship_update
├── style.ts             # style_create, style_read, style_update
├── outline.ts           # outline_create, outline_read, outline_update, outline_patch
├── chapter.ts           # chapter_create, chapter_read, chapter_update, chapter_archive, chapter_patch
├── review.ts            # review_execute
├── summary.ts           # summary_create, summary_read
├── thread.ts            # thread_create, thread_read, thread_update
├── timeline.ts          # timeline_create, timeline_read
├── knowledge.ts         # knowledge_create, knowledge_read, knowledge_update, knowledge_delete, knowledge_patch
├── lesson.ts            # lesson_create, lesson_read, lesson_update
├── analysis.ts          # analysis_execute, analysis_read
└── context.ts           # context_assemble
```

### 9.2 注册函数命名

每个文件导出一个注册函数，命名为 `register{Domain}Tools`：

```typescript
// character.ts
export function registerCharacterTools(server: McpServer) { ... }

// character-state.ts
export function registerCharacterStateTools(server: McpServer) { ... }
```

### 9.3 复合域文件

当一个域的工具实现超过 300 行时，可拆分为子文件：

```
tools/
  world/
    index.ts         # registerWorldTools —— 调用子模块
    create.ts        # world_create 实现
    read.ts          # world_read 实现
    check.ts         # world_check 实现
```

但拆分是可选的，不是必须的。MVP 阶段优先保持一域一文件的简洁性。

---

## 10. 验收标准

本规范的验收标准：

1. **命名一致性**：所有 54 个工具名符合 `{domain}_{action}` 格式，无例外。
2. **动词标准化**：无标准集外的动词出现在工具名中。
3. **输出统一性**：所有工具返回 `{ ok, data }` 或 `{ ok, error }` 格式。
4. **CRUD 完整性**：所有可写域有对应 read。跨 Agent 共享域有完整 CRU(D)。
5. **门禁覆盖**：所有写入工具有明确的门禁定义或"无门禁"标注。
6. **Checklist 可执行**：新增工具 Checklist（§8）可直接用于 code review。
7. **文件结构匹配**：`packages/mcp-server/src/tools/` 目录结构与 §9.1 一致。
