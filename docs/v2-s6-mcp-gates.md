# S6 — MCP 工具与门禁设计

> 本章定义所有 MCP 工具的接口、门禁前置条件和分类体系。  
> **设计规范**：工具命名、Schema、CRUD 规则详见 `specs/mcp-tools/SPEC.md`。  
> **技术实现**：包结构、启动方式、DB 访问详见 `docs/v2-s11-technical-architecture.md` §3。

---

## 目录

1. [工具体系总览](#1-工具体系总览)
2. [门禁机制设计](#2-门禁机制设计)
3. [工具接口定义](#3-工具接口定义)
   - 3.1 [项目管理（project, gate）](#31-项目管理projectgate)
   - 3.2 [灵感脑暴（brainstorm）](#32-灵感脑暴brainstorm)
   - 3.3 [世界观（world）](#33-世界观world)
   - 3.4 [角色（character, character_state, relationship）](#34-角色charactercharacter_staterelationship)
   - 3.5 [写作准备（style, outline）](#35-写作准备styleoutline)
   - 3.6 [章节写作（chapter, context）](#36-章节写作chaptercontext)
   - 3.7 [审校（review）](#37-审校review)
   - 3.8 [归档（summary, thread, timeline）](#38-归档summarythreadtimeline)
   - 3.9 [知识库（knowledge, lesson）](#39-知识库knowledgelesson)
   - 3.10 [分析（analysis）](#310-分析analysis)
4. [门禁依赖图](#4-门禁依赖图)
5. [统一响应格式](#5-统一响应格式)
6. [工具—Agent 映射](#6-工具agent-映射)

---

## 1. 工具体系总览

### 1.1 设计原则

- **命名统一**：`{domain}_{action}`，动作来自标准动词集 {create, read, update, delete, check, execute, assemble, archive, patch}
- **CRUD 对称**：可写域必有 read，跨 Agent 共享域有完整 CRU(D)
- **输出统一**：成功 `{ ok: true, data }` / 失败 `{ ok: false, error: { code, message, details? } }`
- **子类型参数化**：同一域的子类型用 `type` 参数区分，不膨胀工具名
- **门禁内置**：每个写入工具在执行前检查前置条件，拒绝时返回原因和建议

### 1.2 工具域总览（18 域 54 工具）

| # | 域 | 工具数 | 动作 | 文件 |
|---|---|---|---|---|
| 1 | `project` | 2 | read, update | project.ts |
| 2 | `gate` | 1 | check | project.ts |
| 3 | `brainstorm` | 4 | create, read, update, **patch** | brainstorm.ts |
| 4 | `world` | 6 | create, read, update, delete, check, **patch** | world.ts |
| 5 | `character` | 5 | create, read, update, delete, **patch** | character.ts |
| 6 | `character_state` | 2 | create, read | character-state.ts |
| 7 | `relationship` | 3 | create, read, update | relationship.ts |
| 8 | `style` | 3 | create, read, update | style.ts |
| 9 | `outline` | 4 | create, read, update, **patch** | outline.ts |
| 10 | `chapter` | 5 | create, read, update, archive, **patch** | chapter.ts |
| 11 | `review` | 1 | execute | review.ts |
| 12 | `summary` | 2 | create, read | summary.ts |
| 13 | `thread` | 3 | create, read, update | thread.ts |
| 14 | `timeline` | 2 | create, read | timeline.ts |
| 15 | `knowledge` | 5 | create, read, update, delete, **patch** | knowledge.ts |
| 16 | `lesson` | 3 | create, read, update | lesson.ts |
| 17 | `analysis` | 2 | execute, read | analysis.ts |
| 18 | `context` | 1 | assemble | context.ts |
| | **合计** | **54** | | |

> `_patch` 工具详见 `docs/v2-s11-technical-architecture.md` §3.9。所有 `_patch` 工具共享相同的 find/replace 语义和 `patches: [{ find, replace }]` 输入格式。

---

## 2. 门禁机制设计

### 2.1 门禁架构

```
Agent 调用 MCP 工具
  → 门禁检查（DB 查询）
    → 通过 → 执行 DB 操作 → 返回 { ok: true, data }
    → 不通过 → 返回 { ok: false, error: { code: "GATE_FAILED", ... } }
```

### 2.2 实现原则

1. **门禁在工具内部**——每个 MCP 工具在执行前先检查前置条件
2. **不依赖外部状态机**——门禁逻辑全部基于 DB 查询，无内存状态
3. **拒绝时说明原因**——让 Agent 知道缺什么，可以告知用户或自动补救
4. **幂等性**——重复调用同一工具不产生副作用
5. **读取免门禁**——所有 `_read` 工具无门禁，Agent 在任何阶段都能读

### 2.3 门禁级别

| 级别 | 含义 | 失败行为 |
|------|------|----------|
| **HARD** | 必须满足，否则操作无意义 | 拒绝 + 返回 `GATE_FAILED` |
| **SOFT** | 建议满足，但可以跳过 | 警告 + 仍然执行 |
| **INFO** | 提示性信息 | 执行 + 附带提示 |

---

## 3. 工具接口定义

> **约定**：
> - 所有 `input` 使用 Zod v4 语法
> - 所有 `output` 遵循统一格式（§5）
> - `gate: 无` 表示该工具无前置条件
> - 省略的通用字段：`createdAt`、`updatedAt` 在返回值中始终包含但不逐一列出

### 3.1 项目管理（project, gate）

#### `project_read`

```typescript
// 读取项目基本信息与当前阶段
input: {
  projectId: string
}
output.data: {
  id: string,
  name: string,
  genre: string,
  subGenre: string | null,
  phase: "brainstorm" | "world" | "character" | "outline" | "writing" | "completed",
  chapterCount: number,
  wordCount: number,
  config: {                    // 项目级配置
    targetWordCount: number | null,
    writerPreset: string | null,
    modelOverrides: Record<string, string> | null
  }
}
gate: 无
agent: 墨衡
```

#### `project_update`

```typescript
// 更新项目基本信息或配置
input: {
  projectId: string,
  name: string?,
  genre: string?,
  subGenre: string?,
  phase: ("brainstorm" | "world" | "character" | "outline" | "writing" | "completed")?,
  config: {
    targetWordCount: number?,
    writerPreset: string?,
    modelOverrides: Record<string, string>?
  }?
}
output.data: { id: string }
gate: 无
agent: 墨衡
```

#### `gate_check`

```typescript
// 通用门禁预检（墨衡在委派前调用，检查目标操作的前置条件）
input: {
  projectId: string,
  action: "brainstorm" | "world_design" | "character_design" | "outline_design"
        | "style_design" | "chapter_write" | "review" | "archive" | "analysis",
  params: Record<string, any>?   // 如 { chapterNumber: 1 }
}
output.data: {
  passed: boolean,
  conditions: Array<{
    description: string,
    level: "HARD" | "SOFT" | "INFO",
    met: boolean,
    suggestion: string?        // 未满足时的建议操作
  }>
}
gate: 无（这个工具本身就是门禁检查器）
agent: 墨衡
```

---

### 3.2 灵感脑暴（brainstorm）

#### `brainstorm_create`

```typescript
// 创建脑暴文档（发散/聚焦/创意简报）
input: {
  projectId: string,
  type: "diverge" | "focus" | "brief",
  content: string              // JSON 字符串，结构按 type 不同
}
output.data: { id: string }
gate: 无（灵感阶段无前置条件）
agent: 灵犀
```

#### `brainstorm_read`

```typescript
// 读取脑暴文档
input: {
  projectId: string,
  brainstormId: string?,       // 传 ID 读单个，不传读列表
  type: ("diverge" | "focus" | "brief")?  // 列表过滤
}
output.data: BrainstormDocument | BrainstormDocument[]
// BrainstormDocument: { id, type, content, createdAt, updatedAt }
gate: 无
agent: 灵犀, 墨衡
```

#### `brainstorm_update`

```typescript
// 更新脑暴文档
input: {
  projectId: string,
  brainstormId: string,
  content: string
}
output.data: { id: string }
gate: 无
agent: 灵犀
```

#### `brainstorm_patch`

```typescript
// 局部编辑脑暴文档（find/replace）
input: {
  projectId: string,
  brainstormId: string,
  patches: [{ find: string, replace: string }]   // 1-20 个替换操作
}
output.data: { id: string, appliedCount: number }
gate: 无
agent: 灵犀, 墨衡
```

---

### 3.3 世界观（world）

> 世界观子实体（设定/子系统/地点/术语）统一为 `world_*` 工具，用 `type` 参数区分。

#### `world_create`

```typescript
// 创建世界观条目
input: {
  projectId: string,
  type: "setting" | "subsystem" | "location" | "glossary",
  name: string,
  content: string,             // JSON 字符串，结构按 type 不同
  // type=setting 时：
  section: ("base" | "custom")?,
  // type=location 时：
  connections: Array<{ targetId: string, relationType: string, distance: string? }>?,
  // type=glossary 时：
  category: string?,
  definition: string?
}
output.data: { id: string, type: string }
gate:
  HARD: 创意简报已存在（brainstorm type="brief" 存在）
agent: 匠心
```

#### `world_read`

```typescript
// 读取世界观条目
input: {
  projectId: string,
  worldId: string?,            // 传 ID 读单个
  type: ("setting" | "subsystem" | "location" | "glossary")?,  // 按类型过滤
  section: ("base" | "custom")?  // type=setting 时进一步过滤
}
output.data: WorldEntry | WorldEntry[]
// WorldEntry: { id, type, name, content, section?, connections?, category?, definition?, createdAt, updatedAt }
gate: 无
agent: 匠心, 执笔, 载史, 博闻
```

#### `world_update`

```typescript
// 更新世界观条目
input: {
  projectId: string,
  worldId: string,
  name: string?,
  content: string?,
  section: ("base" | "custom")?,
  connections: Array<{ targetId: string, relationType: string, distance: string? }>?,
  category: string?,
  definition: string?
}
output.data: { id: string }
gate:
  HARD: 目标条目存在
agent: 匠心
```

#### `world_delete`

```typescript
// 删除世界观条目（软删除）
input: {
  projectId: string,
  worldId: string
}
output.data: { id: string }
gate:
  HARD: 目标条目存在
  SOFT: 无其他条目引用该条目（有引用时警告但仍执行）
agent: 匠心
```

#### `world_check`

```typescript
// 世界观一致性检查
input: {
  projectId: string
}
output.data: {
  passed: boolean,
  issues: Array<{
    type: "contradiction" | "missing" | "circular" | "orphan",
    severity: "critical" | "warning" | "info",
    description: string,
    affected: string[]         // 涉及的条目 ID
  }>
}
gate:
  HARD: 至少有一个世界设定存在
agent: 匠心, 博闻
note: 检查结果自动保存到 project_documents（type="world_check_report"）
```

#### `world_patch`

```typescript
// 局部编辑世界设定/子系统/地点内容（find/replace）
input: {
  projectId: string,
  worldId: string,
  patches: [{ find: string, replace: string }]   // 1-20 个替换操作
}
output.data: { id: string, appliedCount: number }
gate: 无
agent: 匠心, 博闻
```

---

### 3.4 角色（character, character_state, relationship）

#### `character_create`

```typescript
// 创建角色
input: {
  projectId: string,
  name: string,
  role: "protagonist" | "deuteragonist" | "antagonist" | "supporting" | "minor",
  designDepth: "core" | "important" | "supporting" | "decoration",
  profile: string              // JSON：{ ghost?, wound?, lie?, want?, need?,
                               //         personality, background, appearance?,
                               //         speechPattern?, goals: string[] }
                               // 核心层必须有完整五维心理模型
}
output.data: { id: string }
gate:
  HARD: 创意简报已存在
  HARD: 基础世界设定已存在（world type="setting" section="base"）
  SOFT: 至少一个力量体系子系统已定义（警告但允许）
agent: 匠心
```

#### `character_read`

```typescript
// 读取角色列表或单个角色详情
input: {
  projectId: string,
  characterId: string?,
  role: ("protagonist" | "deuteragonist" | "antagonist" | "supporting" | "minor")?,
  designDepth: ("core" | "important" | "supporting" | "decoration")?
}
output.data: Character | Character[]
// Character: { id, name, role, designDepth, profile, createdAt, updatedAt }
gate: 无
agent: 匠心, 执笔, 载史, 博闻, 析典
```

#### `character_update`

```typescript
// 更新角色信息
input: {
  projectId: string,
  characterId: string,
  name: string?,
  role: ("protagonist" | "deuteragonist" | "antagonist" | "supporting" | "minor")?,
  designDepth: ("core" | "important" | "supporting" | "decoration")?,
  profile: string?             // JSON，同 character_create
}
output.data: { id: string }
gate:
  HARD: 该角色存在
agent: 匠心
```

#### `character_delete`

```typescript
// 删除角色（软删除）
input: {
  projectId: string,
  characterId: string
}
output.data: { id: string }
gate:
  HARD: 该角色存在
  SOFT: 该角色未在已归档章节中出场（有出场时警告但仍执行）
agent: 匠心
```

#### `character_patch`

```typescript
// 局部编辑角色资料（find/replace）
input: {
  projectId: string,
  characterId: string,
  patches: [{ find: string, replace: string }]   // 1-20 个替换操作
}
output.data: { id: string, appliedCount: number }
gate: 无
agent: 匠心, 博闻
```

#### `character_state_create`

```typescript
// 记录角色在某章节后的状态快照
input: {
  projectId: string,
  characterId: string,
  chapterNumber: number,
  state: string                // JSON：{ location?, mood?, knowledgeGained?: string[],
                               //         lieProgress?: number (0-1),
                               //         injuries?: string[], inventory?: string[],
                               //         notes?: string }
}
output.data: { id: string }
gate:
  HARD: 该角色存在
  HARD: 该章节内容已存在
agent: 载史
```

#### `character_state_read`

```typescript
// 读取角色状态快照
input: {
  projectId: string,
  characterId: string?,        // 不传则读全部角色
  chapterNumber: number?,      // 不传则读最新
  range: { from: number, to: number }?  // 读取范围
}
output.data: CharacterState | CharacterState[]
// CharacterState: { id, characterId, characterName, chapterNumber, state, createdAt }
gate: 无
agent: 执笔, 载史, 博闻
```

#### `relationship_create`

```typescript
// 创建角色关系
input: {
  projectId: string,
  sourceCharacterId: string,
  targetCharacterId: string,
  type: "ally" | "enemy" | "mentor" | "student" | "family" | "rival" | "lover" | string,
  description: string,
  bidirectional: boolean?      // 默认 true
}
output.data: { id: string }
gate:
  HARD: 两个角色都已存在
  SOFT: 该关系不重复（相同双方+类型已存在时警告）
agent: 匠心
```

#### `relationship_read`

```typescript
// 读取角色关系
input: {
  projectId: string,
  characterId: string?,        // 读取某角色的所有关系
  relationshipId: string?      // 读取特定关系
}
output.data: Relationship | Relationship[]
// Relationship: { id, sourceCharacterId, sourceCharacterName, targetCharacterId,
//                 targetCharacterName, type, description, bidirectional, createdAt, updatedAt }
gate: 无
agent: 匠心, 执笔, 载史
```

#### `relationship_update`

```typescript
// 更新角色关系
input: {
  projectId: string,
  relationshipId: string,
  type: string?,
  description: string?
}
output.data: { id: string }
gate:
  HARD: 该关系存在
agent: 匠心, 载史
```

---

### 3.5 写作准备（style, outline）

#### `style_create`

```typescript
// 创建文风配置
input: {
  projectId: string,
  preset: string?,             // 9 种子写手预设之一（云墨/剑心/星河/...）
  config: string               // JSON：{ yaml: string, prose: string,
                               //         examples: string[], modelOverride?: string }
}
output.data: { id: string }
gate:
  HARD: 创意简报已存在
  SOFT: 至少 1 个主要角色已定义
agent: 执笔（由墨衡委派）
```

#### `style_read`

```typescript
// 读取文风配置
input: {
  projectId: string,
  styleId: string?
}
output.data: StyleConfig | StyleConfig[]
// StyleConfig: { id, preset, config, createdAt, updatedAt }
gate: 无
agent: 执笔, 墨衡, 匠心
```

#### `style_update`

```typescript
// 更新文风配置
input: {
  projectId: string,
  styleId: string,
  preset: string?,
  config: string?
}
output.data: { id: string }
gate:
  HARD: 该文风配置存在
agent: 执笔
```

#### `outline_create`

```typescript
// 创建大纲（含弧段划分）
input: {
  projectId: string,
  synopsis: string,
  arcs: Array<{
    title: string,
    startChapter: number,
    endChapter: number,
    coreConflict: string,
    climax: string,
    keyCharacterIds: string[]
  }>
}
output.data: { id: string, arcIds: string[] }
gate:
  HARD: 创意简报已存在
  HARD: 基础世界设定已存在
  HARD: 至少 2 个主要角色已定义（protagonist/deuteragonist/antagonist）
  HARD: 至少 1 个角色关系已建立
agent: 匠心
```

#### `outline_read`

```typescript
// 读取大纲（完整或指定弧段）
input: {
  projectId: string,
  arcIndex: number?,           // 不传读完整大纲
  chapterNumber: number?       // 读特定章节的 Plantser Brief
}
output.data: {
  id: string,
  synopsis: string,
  arcs: Array<{
    index: number,
    title: string,
    startChapter: number,
    endChapter: number,
    coreConflict: string,
    climax: string,
    keyCharacterIds: string[],
    chapterBriefs: Array<{     // 已填写的章节详案
      chapterNumber: number,
      title: string,
      brief: string
    }>
  }>
}
gate: 无
agent: 匠心, 执笔, 墨衡
```

#### `outline_update`

```typescript
// 更新大纲（弧段元数据或添加/修改章节详案 Plantser Brief）
input: {
  projectId: string,
  // 更新弧段：
  arcIndex: number?,
  arcData: {
    title: string?,
    startChapter: number?,
    endChapter: number?,
    coreConflict: string?,
    climax: string?
  }?,
  // 添加/更新章节详案：
  chapterBrief: {
    chapterNumber: number,
    title: string,
    brief: string              // Plantser Brief 内容
  }?,
  // 更新总纲要：
  synopsis: string?
}
output.data: { id: string }
gate:
  HARD: 大纲已存在
agent: 匠心
```

#### `outline_patch`

```typescript
// 局部编辑大纲内容（find/replace，适合调整某章 brief 而非重写整个大纲）
input: {
  projectId: string,
  outlineId: string,
  patches: [{ find: string, replace: string }]   // 1-20 个替换操作
}
output.data: { id: string, appliedCount: number }
gate: 无
agent: 匠心
```

---

### 3.6 章节写作（chapter, context）

#### `chapter_create`

```typescript
// 创建章节（首次写入或创建新版本用于择优）
input: {
  projectId: string,
  chapterNumber: number,
  title: string,
  content: string,
  wordCount: number?,          // 不传则自动计算
  writerPreset: string?        // 使用的子写手预设
}
output.data: { id: string, version: number }
gate:
  HARD: 大纲已存在
  HARD: 该章节的 Plantser Brief 已定义
  HARD: 文风配置已确定
  HARD: 涉及角色状态已就绪（有状态记录或为第 1 章）
  HARD: 该章节无 "archived" 状态版本（防止覆盖已归档版本）
  SOFT: 世界观已通过一致性检查
agent: 执笔
```

#### `chapter_read`

```typescript
// 读取章节内容
input: {
  projectId: string,
  chapterNumber: number?,      // 不传读列表（不含 content）
  version: number?,            // 不传读最新版本
  includeContent: boolean?     // 列表模式下是否包含正文，默认 false
}
output.data: Chapter | ChapterSummary[]
// Chapter: { id, chapterNumber, version, title, content, wordCount, status, writerPreset, createdAt, updatedAt }
// ChapterSummary: { id, chapterNumber, latestVersion, title, wordCount, status, createdAt }
gate: 无
agent: 执笔, 明镜, 载史, 博闻, 析典, 墨衡
```

#### `chapter_update`

```typescript
// 基于审校反馈修订章节（局部修改，非全文重写）
input: {
  projectId: string,
  chapterNumber: number,
  feedback: Array<{
    issue: string,
    severity: "critical" | "major" | "minor" | "suggestion",
    suggestion: string,
    lineRange: [number, number]?
  }>,
  revisedContent: string
}
output.data: { id: string, version: number }
gate:
  HARD: 该章节已存在
  HARD: 有对应的审校报告
agent: 执笔
```

#### `chapter_archive`

```typescript
// 归档章节（标记为 archived，冻结版本）
input: {
  projectId: string,
  chapterNumber: number
}
output.data: { id: string, version: number }
gate:
  HARD: 该章节最新版本审校通过（四轮全部完成）
  HARD: 章节摘要已生成
  HARD: 伏笔状态已更新
  HARD: 时间线已记录
  HARD: 角色状态已快照
agent: 载史
```

#### `chapter_patch`

```typescript
// 局部编辑章节内容（find/replace，审校后改段落最高频场景）
input: {
  projectId: string,
  chapterId: string,
  patches: [{ find: string, replace: string }]   // 1-20 个替换操作
}
output.data: { id: string, appliedCount: number }
gate: 无
agent: 执笔, 明镜
```

#### `context_assemble`

```typescript
// 为执笔组装写作上下文（核心只读复合工具）
// 内部实现 UNM（统一叙事记忆）引擎逻辑
input: {
  projectId: string,
  chapterNumber: number,
  mode: ("write" | "revise" | "rewrite")?  // 默认 "write"
}
output.data: {
  brief: string,               // 章节 Plantser Brief
  worldContext: string,         // 相关世界设定（按 Brief 涉及的地点/术语筛选）
  characterStates: string,     // 涉及角色最新状态
  previousSummary: string?,    // 前文摘要（前 N 章递归压缩）
  styleConfig: string,         // 文风配置
  lessons: string[],           // 相关写作教训
  threads: string[],           // 活跃伏笔
  arcContext: string,          // 当前弧段上下文（弧段冲突/高潮/进度）
  tokenBudget: Record<string, number>  // 各部分 token 分配
}
gate:
  HARD: 大纲已存在
  HARD: 该章节的 Brief 已定义
  HARD: 文风配置已确定
agent: 执笔
note: 三种模式的上下文量级不同——
  write: 完整上下文（~54K chars），用于首次创作
  revise: 最小上下文，仅包含待修改相关信息，用于定向修复
  rewrite: 中等上下文，排除旧章节正文防止锚定，用于全文重写
```

---

### 3.7 审校（review）

#### `review_execute`

```typescript
// 执行审校（四轮合一，由 round 参数区分）
input: {
  projectId: string,
  chapterNumber: number,
  round: 1 | 2 | 3 | 4
  // Round 1: AI 痕迹检测
  // Round 2: 逻辑一致性检查
  // Round 3: 文学质量评估
  // Round 4: 终审（综合判定 pass/fail）
}
output.data: {
  round: number,
  passed: boolean,
  score: number?,              // Round 3/4 有综合评分（1-100）
  metrics: Record<string, number>?,  // 各项指标评分
  issues: Array<{
    issue: string,
    severity: "critical" | "major" | "minor" | "suggestion",
    evidence: string,          // 原文引用
    suggestion: string,
    expectedEffect: string     // 修改后预期效果
  }>
}
gate:
  HARD: 该章节内容已存在
  HARD (round 2): Round 1 已完成
  HARD (round 3): Round 2 已完成
  HARD (round 4): Round 3 已完成
agent: 明镜
note: 审校报告自动保存到 project_documents（type="review_report"）
```

---

### 3.8 归档（summary, thread, timeline）

#### `summary_create`

```typescript
// 创建摘要（章节摘要或弧段摘要）
input: {
  projectId: string,
  type: "chapter" | "arc",
  // type=chapter 时：
  chapterNumber: number?,
  // type=arc 时：
  arcIndex: number?,
  content: string              // 摘要正文
}
output.data: { id: string }
gate:
  type=chapter:
    HARD: 该章节审校通过（四轮完成）
  type=arc:
    HARD: 该弧段内所有章节已归档
agent: 载史
```

#### `summary_read`

```typescript
// 读取摘要
input: {
  projectId: string,
  type: ("chapter" | "arc")?,
  chapterNumber: number?,      // 读特定章节摘要
  arcIndex: number?,           // 读特定弧段摘要
  range: { from: number, to: number }?  // 读取章节范围
}
output.data: Summary | Summary[]
// Summary: { id, type, chapterNumber?, arcIndex?, content, createdAt }
gate: 无
agent: 载史, 执笔, 博闻, 析典
```

#### `thread_create`

```typescript
// 创建伏笔
input: {
  projectId: string,
  title: string,
  description: string,
  plantedChapter: number,      // 埋设章节
  expectedPayoff: number?      // 预期回收章节
}
output.data: { id: string }
gate:
  HARD: plantedChapter 已存在内容
agent: 载史
```

#### `thread_read`

```typescript
// 读取伏笔列表
input: {
  projectId: string,
  threadId: string?,           // 读取单个伏笔详情
  status: ("active" | "resolved" | "abandoned")?,  // 按状态过滤
  chapterNumber: number?       // 读取截至某章的活跃伏笔
}
output.data: Thread | Thread[]
// Thread: { id, title, description, status, plantedChapter, expectedPayoff?,
//           progressLog: Array<{ chapterNumber, action, note }>, createdAt, updatedAt }
gate: 无
agent: 执笔, 载史, 博闻
```

#### `thread_update`

```typescript
// 更新伏笔状态（推进/回收/废弃）
input: {
  projectId: string,
  threadId: string,
  action: "advance" | "resolve" | "abandon",
  chapterNumber: number,       // 发生变化的章节
  note: string                 // 描述变化
}
output.data: { id: string }
gate:
  HARD: 该伏笔存在
  HARD: 该章节已审校通过
agent: 载史
```

#### `timeline_create`

```typescript
// 记录时间线事件
input: {
  projectId: string,
  chapterNumber: number,
  events: Array<{
    storyTimestamp: string,     // 故事内时间（如 "第三天 傍晚"）
    description: string,
    characterIds: string[],    // 涉及角色
    locationId: string?        // 发生地点
  }>
}
output.data: { ids: string[] }
gate:
  HARD: 该章节审校通过
agent: 载史
```

#### `timeline_read`

```typescript
// 读取时间线
input: {
  projectId: string,
  chapterRange: { from: number, to: number }?,  // 章节范围
  characterId: string?,        // 按角色过滤
  locationId: string?          // 按地点过滤
}
output.data: TimelineEvent[]
// TimelineEvent: { id, chapterNumber, storyTimestamp, description, characterIds, locationId, createdAt }
gate: 无
agent: 载史, 执笔, 博闻
```

---

### 3.9 知识库（knowledge, lesson）

#### `knowledge_create`

```typescript
// 创建知识条目
input: {
  projectId: string,
  category: "technique" | "genre" | "style" | "reference",
  title: string,
  content: string,
  tags: string[]?,
  sourceNote: string?            // 来源描述（如 "外部分析提取"、"用户指导"）
}
output.data: { id: string }
gate: 无
agent: 博闻
```

#### `knowledge_read`

```typescript
// 读取知识条目
input: {
  projectId: string,
  knowledgeId: string?,
  category: ("technique" | "genre" | "style" | "reference")?,
  tags: string[]?,             // 按标签过滤（AND）
  query: string?               // 全文搜索
}
output.data: KnowledgeEntry | KnowledgeEntry[]
// KnowledgeEntry: { id, category, title, content, tags, source, createdAt, updatedAt }
gate: 无
agent: 博闻, 执笔, 析典, 墨衡
```

#### `knowledge_update`

```typescript
// 更新知识条目
input: {
  projectId: string,
  knowledgeId: string,
  title: string?,
  content: string?,
  tags: string[]?,
  category: ("technique" | "genre" | "style" | "reference")?
}
output.data: { id: string }
gate:
  HARD: 该条目存在
agent: 博闻
```

#### `knowledge_delete`

```typescript
// 删除知识条目（软删除）
input: {
  projectId: string,
  knowledgeId: string
}
output.data: { id: string }
gate:
  HARD: 该条目存在
agent: 博闻
```

#### `knowledge_patch`

```typescript
// 局部编辑知识条目内容（find/replace）
input: {
  projectId: string,
  knowledgeId: string,
  patches: [{ find: string, replace: string }]   // 1-20 个替换操作
}
output.data: { id: string, appliedCount: number }
gate: 无
agent: 博闻
```

#### `lesson_create`

```typescript
// 从用户修正或审校反馈中提取教训
input: {
  projectId: string,
  source: string,              // 来源描述（如 "第12章用户修改"、"审校反馈"）
  pattern: string,             // 问题模式描述
  correction: string,          // 修正方式
  category: "anti_ai" | "consistency" | "style" | "pacing" | "character" | "worldbuilding",
  severity: ("high" | "medium" | "low")?
}
output.data: { id: string }
gate: 无
agent: 博闻, 墨衡
```

#### `lesson_read`

```typescript
// 读取教训条目
input: {
  projectId: string,
  lessonId: string?,
  category: ("anti_ai" | "consistency" | "style" | "pacing" | "character" | "worldbuilding")?,
  active: boolean?             // 是否只读活跃的，默认 true
}
output.data: Lesson | Lesson[]
// Lesson: { id, source, pattern, correction, category, severity, active, hitCount, createdAt, updatedAt }
gate: 无
agent: 执笔, 博闻, 墨衡
```

#### `lesson_update`

```typescript
// 更新教训（修正内容或标记为失效）
input: {
  projectId: string,
  lessonId: string,
  pattern: string?,
  correction: string?,
  category: ("anti_ai" | "consistency" | "style" | "pacing" | "character" | "worldbuilding")?,
  active: boolean?             // false = 废弃
}
output.data: { id: string }
gate:
  HARD: 该条目存在
agent: 博闻, 墨衡
```

---

### 3.10 分析（analysis）

#### `analysis_execute`

```typescript
// 执行析典九维分析
input: {
  projectId: string,
  scope: "chapter" | "arc" | "full",
  range: { start: number, end: number }?  // scope=chapter 或 arc 时指定范围
}
output.data: {
  dimensions: Record<string, {
    score: number,             // 1-100
    analysis: string,
    trend: ("improving" | "stable" | "declining")?,
    suggestions: string[]
  }>,
  overall: number,             // 综合评分
  topIssues: string[],         // 最突出的问题
  comparison: {                // 与前次分析的对比
    previousOverall: number?,
    delta: number?
  }?
}
gate:
  HARD: 指定范围内至少有 1 章已归档
agent: 析典
note: 分析结果自动保存到 project_documents（type="analysis_report"）
```

#### `analysis_read`

```typescript
// 读取历史分析报告
input: {
  projectId: string,
  scope: ("chapter" | "arc" | "full")?,
  range: { start: number, end: number }?,
  latest: boolean?             // 只读最新一份，默认 false
}
output.data: AnalysisReport | AnalysisReport[]
// AnalysisReport: { id, scope, range, dimensions, overall, topIssues, createdAt }
gate: 无
agent: 析典, 墨衡, 博闻
```

---

## 4. 门禁依赖图

创作流程的门禁前置条件形成如下依赖链：

```
创意简报（brainstorm type=brief）
  ├── → 基础世界设定（world type=setting section=base）
  │       ├── → 子系统（world type=subsystem）
  │       │       └── ·SOFT→ 角色创建
  │       ├── → 地点（world type=location）
  │       ├── → 术语（world type=glossary）
  │       └── → 角色创建（character_create）
  │               ├── → 角色关系（relationship_create）
  │               │       └── → 大纲（outline_create）
  │               │               ├── → 章节详案（outline_update + chapterBrief）
  │               │               │       └── → 章节写作（chapter_create）
  │               │               │               └── → 审校（review_execute）
  │               │               │                       └── → 归档（chapter_archive）
  │               │               │                               ├── 摘要（summary_create）
  │               │               │                               ├── 伏笔更新（thread_update）
  │               │               │                               ├── 时间线（timeline_create）
  │               │               │                               ├── 角色状态（character_state_create）
  │               │               │                               └── 弧段摘要（当弧段完成时）
  │               │               └── ·SOFT→ 文风配置
  │               └── ·SOFT→ 文风配置
  └── → 文风配置（style_create）
```

**关键路径**（必须按顺序）：
```
创意简报 → 世界设定 → 角色(×2) → 关系(×1) → 大纲 → 章节详案 → [文风] → 章节写作 → 审校(×4轮) → 归档
```

**并行路径**：
- 世界设定和文风配置可以并行（都只依赖创意简报）
- 角色设计与子系统/地点/术语可以并行（都依赖基础世界设定）
- 归档的 4 个操作（摘要/伏笔/时间线/角色状态）可以并行

---

## 5. 统一响应格式

### 5.1 成功响应

```typescript
{ ok: true, data: T }
```

### 5.2 失败响应

```typescript
{
  ok: false,
  error: {
    code: "GATE_FAILED" | "NOT_FOUND" | "CONFLICT" | "VALIDATION" | "PATCH_NO_MATCH" | "INTERNAL",
    message: string,           // 人类可读的错误描述（中文）
    details?: {
      // GATE_FAILED 时：
      passed?: string[],
      failed?: string[],
      suggestions?: string[]
    }
  }
}
```

### 5.3 MCP 协议包装

实际通过 MCP 返回的格式是 `{ content: [{ type: "text", text: JSON.stringify(response) }] }`。上述 JSON 结构是 `text` 字段的内容。

```typescript
// packages/mcp-server/src/utils/response.ts

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

## 6. 工具—Agent 映射

每个 Agent 可使用的工具白名单（在 `agents/*.md` 的 frontmatter `tools` 字段中配置）：

### 墨衡（moheng）— 协调器

```
project_read, project_update, gate_check,
brainstorm_read, outline_read, style_read,
chapter_read, summary_read, analysis_read,
knowledge_read, lesson_read, lesson_create
```

### 灵犀（lingxi）— 灵感

```
brainstorm_create, brainstorm_read, brainstorm_update, brainstorm_patch,
project_read
```

### 匠心（jiangxin）— 设计

```
world_create, world_read, world_update, world_delete, world_check, world_patch,
character_create, character_read, character_update, character_delete, character_patch,
relationship_create, relationship_read, relationship_update,
outline_create, outline_read, outline_update, outline_patch,
project_read, knowledge_read
```

### 执笔（zhibi）— 写作

```
context_assemble,
chapter_create, chapter_read, chapter_update, chapter_patch,
style_create, style_read, style_update,
character_read, character_state_read,
world_read, outline_read, thread_read,
knowledge_read, lesson_read, summary_read
```

### 明镜（mingjing）— 审校

```
review_execute,
chapter_read, chapter_patch, character_read, world_read,
outline_read, thread_read, knowledge_read, lesson_read
```

### 载史（zaishi）— 归档

```
chapter_archive,
summary_create, summary_read,
thread_create, thread_read, thread_update,
timeline_create, timeline_read,
character_state_create, character_state_read,
chapter_read, character_read, world_read, outline_read
```

### 博闻（bowen）— 知识库

```
knowledge_create, knowledge_read, knowledge_update, knowledge_delete, knowledge_patch,
lesson_create, lesson_read, lesson_update,
chapter_read, character_read, world_read,
thread_read, summary_read, timeline_read
```

### 析典（xidian）— 分析

```
analysis_execute, analysis_read,
chapter_read, character_read, world_read,
summary_read, thread_read, knowledge_read, timeline_read
```

### 书虫（shuchong）— 读者反馈

```
chapter_read, character_read, world_read,
summary_read, outline_read
```

### 点睛（dianjing）— 标题/简介

```
project_read, chapter_read, outline_read,
character_read, world_read, summary_read
```
