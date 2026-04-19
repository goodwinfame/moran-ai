# agents — SPEC

> **状态**：已完成
> **模块**：agents
> **最后更新**：2026-04-19

## 1. 概述

Agent 模块定义墨染 V2 的 10 个 AI Agent 体系（5 核心 + 3 支援 + 2 可选），包括各 Agent 的配置（模型、温度、权限）、墨衡委派机制、54 个 MCP 工具接口、门禁校验系统。所有 Agent prompt 在 OpenCode config 中定义，不在 packages/agents/ 中写代码。

技术栈：OpenCode serve（Agent 运行时）+ MCP Server（工具层）+ PostgreSQL（数据持久化）。

## 2. 功能需求

### 2.1 Agent 体系

#### 核心 Agent（5 个）

| Agent | 英文 | 模型 | 温度 | 权限 | 核心职责 |
|-------|------|------|------|------|---------|
| 墨衡 | moheng | Claude Sonnet 4 | 0.3 | read+write+tools+dispatch | 唯一用户入口，全流程协调器 |
| 灵犀 | lingxi | Claude Sonnet 4 | 0.9 | read+write+tools | 灵感碰撞（发散→聚焦→结晶） |
| 匠心 | jiangxin | Claude Sonnet 4 | 0.5 | read+write+tools | 世界观/角色/结构设计 |
| 执笔 | zhibi | Claude Sonnet 4 | 动态 0.5-0.85 | read+write+tools | 章节写作（9 个子写手风格） |
| 明镜 | mingjing | Claude Sonnet 4 | 0.2 | read+tools | 四轮质量审校 |

#### 支援 Agent（3 个）

| Agent | 英文 | 模型 | 温度 | 核心职责 |
|-------|------|------|------|---------|
| 载史 | zaishi | Haiku(初筛)+Sonnet(归档) | 0.3 | 章节归档、摘要、状态快照 |
| 博闻 | bowen | Claude Haiku | 0.3 | 知识库管理与查询 |
| 析典 | xidian | Claude Sonnet 4 | 0.4 | 九维分析（雷达图、趋势）+ 外部作品分析 |

#### 可选 Agent（2 个）

| Agent | 英文 | 模型 | 温度 | 核心职责 |
|-------|------|------|------|---------|
| 书虫 | shuchong | Claude Haiku | 0.7 | 模拟目标读者反馈 |
| 点睛 | dianjing | Claude Sonnet 4 | 0.8 | 标题/简介/宣传语生成 |

### 2.2 墨衡委派机制

#### 意图 → Agent 映射

| 用户意图 | 委派给 |
|---------|--------|
| 脑暴/创意 | 灵犀 |
| 世界/设定/角色/大纲 | 匠心 |
| 写作/修订 | 执笔 |
| 审校/质检 | 明镜 |
| 归档/摘要 | 载史 |
| 知识/教训 | 博闻 |
| 分析/诊断 | 析典 |
| 读者反馈 | 书虫 |
| 标题/命名 | 点睛 |
| 聊天/问答 | 墨衡自己回答 |

#### 委派流程

1. 用户消息 → 墨衡意图识别
2. 墨衡调 MCP `project_read` + `gate_check` 查状态
3. 判断委派目标
4. 组装子 Agent 上下文（通过 MCP 查询 DB）
5. `SubtaskPart(agent, context)` 委派
6. 子 Agent 调 MCP 工具执行
7. 结果回流到墨衡
8. 墨衡汇总向用户报告

#### 上下文组装策略

| 子 Agent | 上下文内容 |
|----------|-----------|
| 灵犀 | 项目基本信息 + 用户原始想法 |
| 匠心(世界) | 创意简报 + 已有世界设定 |
| 匠心(角色) | 创意简报 + 世界设定 + 已有角色 |
| 匠心(大纲) | 创意简报 + 世界设定 + 角色表 |
| 执笔(写作) | Brief + 前文摘要 + 世界设定 + 角色状态 + 伏笔 + 文风 + 题材技法 + 教训 |
| 执笔(修订) | 章节内容 + 审校反馈 + 文风 + 教训 |
| 明镜 | 章节内容 + 角色设定 + 世界设定 + 前文摘要 + 通过标准 |
| 载史 | 章节内容 + 角色表 + 伏笔列表 + 时间线 |
| 析典 | 多章节内容 + 角色表 + 世界设定 + 弧段大纲 |

### 2.3 Agent 间通信模型

- ❌ Agent 之间不直接传递消息
- ✅ 所有产出写入 DB（通过 MCP 工具）
- ✅ 通过 MCP 查询获取其他 Agent 的产出

数据依赖链：灵犀产出 → 匠心(世界→角色→大纲) → 执笔(写作) → 明镜(审校) → 载史(归档) → 执笔(下一章)

### 2.4 执笔子写手风格系统

9 种纯文风预设（不绑定题材），每种关联推荐模型。题材技法作为知识库条目（category='genre'）独立存在，由 `context_assemble` 在写作时按需加载。墨衡根据项目题材自动组合文风+题材技法。

| 子名 | 文风特征 | 推荐模型 |
|------|---------|----------|
| 云墨 | 均衡万用、自然流畅 | Claude Sonnet |
| 剑心 | 冷峻简约、短句、白描、动作化叙事 | Kimi K2 |
| 星河 | 精确、技术感、理性叙述 | GPT-4o |
| 素手 | 温暖细腻、长句、情感细写、氛围渲染 | Claude Opus |
| 烟火 | 市井烟火气、口语化、快节奏 | GPT-4o |
| 暗棋 | 层层递进、信息控制、悬念留白 | Claude Opus |
| 青史 | 典雅庄重、文白混用、时代语感 | Claude Opus |
| 夜阑 | 压抑、感官描写密集、心理暗示 | Gemma4 |
| 谐星 | 轻快、节奏明快、反差幽默 | GPT-4o |

**显示名规则**："执笔·{子名}"（如"执笔·云墨"、"执笔·剑心"）。

**模型覆盖优先级**：项目级覆盖 > 全局偏好 > 风格默认

**温度场景化**（5 种章节类型）：
- 日常：0.7-0.8 | 战斗：0.6-0.7 | 情感：0.75-0.85 | 悬疑：0.5-0.6 | 高潮：0.65-0.75

### 2.5 MCP 工具体系（54 个）

#### 分类总览

| 类别 | 工具数 | 工具名称 |
|------|--------|---------|
| 项目管理 | 3 | project_read/update, gate_check |
| 灵感脑暴 | 4 | brainstorm_create/read/update/patch |
| 世界观 | 6 | world_create/read/update/delete/check/patch |
| 角色 | 10 | character_create/read/update/delete/patch, character_state_create/read, relationship_create/read/update |
| 写作准备 | 8 | style_create/read/update, outline_create/read/update/patch, context_assemble |
| 章节写作 | 5 | chapter_create/read/update/archive/patch |
| 审校 | 1 | review_execute |
| 归档 | 7 | summary_create/read, thread_create/read/update, timeline_create/read |
| 知识库 | 8 | knowledge_create/read/update/delete/patch, lesson_create/read/update |
| 分析 | 2 | analysis_execute/read |

#### 关键工具接口

**`gate_check`**（通用门禁检查器）：
```typescript
input: { projectId: string, action: string, params?: Record<string, any> }
output: { ok: boolean, passed: string[], failed: string[], suggestions: string[] }
```

**`context_assemble`**（写作上下文组装，核心工具）：
```typescript
input: { projectId: string, chapterNumber: number, mode?: "write" | "revise" | "rewrite" }
output: {
  ok: boolean,
  data: {
    brief: string, worldContext: string, characterStates: string,
    previousSummary: string | null, styleConfig: string,
    lessons: string[], threads: string[], arcContext: string,
    genreKnowledge: string[],
    tokenBudget: Record<string, number>
  }
}
gate: HARD: 大纲已存在 + Brief 已定义 + 文风已确定
```

**`chapter_create`**：
```typescript
input: { projectId: string, chapterNumber: number, title: string, content: string }
output: { ok: boolean, chapterId: string, version: number }
gate:
  HARD: 大纲已存在 + Brief 已定义 + 角色状态就绪 + 文风已确定 + 无 archived 版本
  SOFT: 世界设定自洽检查通过
```

**`character_create`**：
```typescript
input: {
  projectId: string, name: string,
  role: "protagonist" | "deuteragonist" | "antagonist" | "supporting" | "minor",
  profile: { want, need, lie, ghost, personality, background, appearance?, speechPattern?, goals }
}
output: { ok: boolean, characterId: string }
gate: HARD: 世界设定已存在; SOFT: 力量体系子系统已定义
```

### 2.6 门禁机制

#### 门禁级别

| 级别 | 含义 | 失败行为 |
|------|------|----------|
| **HARD** | 必须满足 | 拒绝 + 返回原因 |
| **SOFT** | 建议满足 | 警告 + 仍然执行 |
| **INFO** | 提示性 | 执行 + 附带提示 |

#### 门禁实现原则

1. 门禁在工具内部——每个 MCP 工具执行前先检查前置条件
2. 不依赖外部状态机——全部基于 DB 查询
3. 拒绝时说明原因——Agent 可告知用户或自动补救
4. 幂等性——重复调用无副作用

#### 门禁依赖链

```
创意简报 → 基础世界设定 → 力量体系子系统(SOFT)
                         → 角色(≥2主要) → 关系网络
创意简报 → 文风配置(SOFT: ≥1角色)
世界设定 + 角色 + 关系 → 大纲 → Brief → 章节写作(+文风)
章节 → 审校通过 → 摘要 → 归档
```

#### 统一错误返回格式

```typescript
interface MCPToolResult {
  ok: boolean;
  data?: any;
  error?: {
    code: "GATE_FAILED" | "NOT_FOUND" | "CONFLICT" | "PATCH_NO_MATCH" | "INTERNAL";
    message: string;
    gate_details?: { passed: string[], failed: string[], suggestions: string[] };
  }
}
```

### 2.7 四轮审校规范

| 轮次 | 维度 | 通过条件 |
|------|------|---------|
| Round 1 | AI 味检测 | Burstiness ≥ 0.3 |
| Round 2 | 逻辑一致性 | 无 critical 矛盾 |
| Round 3 | 文学质量 | RUBRIC ≥ 7.5 |
| Round 4 | 读者体验 | 可选 |

各轮顺序执行：Round 2-4 需前一轮完成。

审校结论：
- ✅ 通过（总分 ≥ 80 且无 🔴）→ 归档
- ⚠️ 修改后通过（总分 ≥ 70 有 🟡）→ 执笔修订
- ❌ 需重写（总分 < 70 或有 🔴）→ 执笔重写

### 2.8 模型配置策略

| 原则 | 说明 |
|------|------|
| 不同 Agent 可用不同模型 | 匠心用 Sonnet，载史用 Haiku |
| 写作用最好的模型 | 执笔、灵犀使用最高质量 |
| 审校独立模型族 | 明镜避免与执笔同模型，减少偏差 |
| 成本分级 | 高频低复杂度用便宜模型 |

## 3. 验收标准

### 3.1 Agent 配置

- [ ] 10 个 Agent 在 OpenCode config 中正确定义（名称、模型、温度、权限）
- [ ] 9 个子写手纯文风配置文件存在且可加载（不绑定题材）
- [ ] 题材技法作为知识库条目（category='genre'）可加载
- [ ] 模型覆盖优先级：项目级 > 全局 > 风格默认
- [ ] 温度场景化：5 种章节类型各有对应范围

### 3.2 墨衡委派

- [ ] 墨衡正确识别 10 种意图并路由到对应 Agent
- [ ] 上下文组装策略按表格为每个 Agent 查询正确的 DB 数据
- [ ] SubtaskPart 委派正确触发
- [ ] 子 Agent 结果回流到墨衡并汇总报告

### 3.3 MCP 工具

- [ ] 54 个 MCP 工具全部可调用
- [ ] 每个工具的 input/output 类型符合 v2-s6 定义
- [ ] HARD 门禁不满足时返回 `{ ok: false, error: { code: "GATE_FAILED", ... } }`
- [ ] SOFT 门禁不满足时返回 `{ ok: true }` + 警告
- [ ] gate_check 工具正确返回 passed/failed/suggestions
- [ ] context_assemble 正确组装写作上下文（brief+world+characters+summary+style+genreKnowledge+lessons+threads）
- [ ] 统一错误格式 MCPToolResult 全部工具遵守

### 3.4 门禁依赖链

- [ ] 无创意简报时不能创建世界设定（HARD）
- [ ] 无世界设定时不能创建角色（HARD）
- [ ] 角色不足 2 个或无关系网络时不能创建大纲（HARD）
- [ ] 无 Brief 时不能写章节（HARD）
- [ ] 无审校通过不能归档（HARD）
- [ ] 已 archived 章节不能覆盖写入（HARD）

### 3.5 四轮审校

- [ ] Round 1-4 顺序执行，前一轮未完成不能执行下一轮
- [ ] 评分、issues、severity 返回格式正确
- [ ] 审校结论（通过/修改/重写）逻辑正确

### 3.6 Agent 通信

- [ ] Agent 间不直接传消息，全部通过 DB + MCP
- [ ] 数据依赖链完整：灵犀→匠心→执笔→明镜→载史→执笔(下一章)
- [ ] `pnpm typecheck` 通过（server + core 包零错误）

## 4. 依赖

- 依赖 `database` 模块（所有 MCP 工具的数据存储）
- 依赖 `opencode-integration` 模块（OpenCode SDK、Session Manager、Agent 运行时）
- 依赖 `sse-realtime` 模块（Agent 状态事件推送）
- 被 `chat-ui`、`info-panel` 通过 SSE 间接引用
