# opencode-integration — SPEC

> **状态**：已完成
> **模块**：opencode-integration
> **最后更新**：2026-04-19

## 1. 概述

OpenCode 集成模块负责：Hono 后端与 OpenCode serve（Docker, :4096）之间的交互。
包含四个核心子系统：Session Manager、MCP Server、门禁机制、Agent 配置。

技术栈：`@opencode-ai/sdk`（必须传 `baseUrl`），Docker 容器 `ghcr.io/anomalyco/opencode:latest`。

## 2. 功能需求

### 2.1 Session Manager

管理 `(userId, projectId)` 到 OpenCode sessionId 的映射。

```typescript
interface OpenCodeSessionManager {
  // 获取或创建 session（幂等）
  getOrCreate(userId: string, projectId: string): Promise<string>;
  // 获取已有 session（不存在返回 null）
  get(userId: string, projectId: string): Promise<string | null>;
  // 健康检查
  checkHealth(): Promise<boolean>;
  // 清理过期 session
  cleanup(maxAge: number): Promise<number>;
}
```

**规则**：
- 一个 (userId, projectId) 对应一个 OpenCode session，1:1 映射
- session 持久化到 DB 或 Redis（TBD in DESIGN）
- `getOrCreate` 幂等：相同参数多次调用返回同一 sessionId
- 健康检查调用 `GET /global/health`（OpenCode 端口 4096）

### 2.2 MCP Server

MCP Server 是一个独立进程/模块，暴露 47 个工具给 OpenCode 中运行的 LLM。
工具通过 DB 操作实现，门禁逻辑内置于工具中。

#### 工具分类（7 类，47 个）

| 类别 | 工具数 | 工具列表 |
|------|--------|----------|
| 项目管理 | 3 | project_read, project_update, gate_check |
| 灵感脑暴 | 3 | brainstorm_create, brainstorm_read, brainstorm_update |
| 世界观 | 10 | world_setting_create/read/update, world_subsystem_create/update, world_consistency_check, location_create/update, glossary_create/update |
| 角色 | 7 | character_create/read/update, character_state_update/snapshot, relationship_create/update |
| 写作 | 10 | style_create/read, outline_create/update, arc_detail_create, context_assemble, chapter_write/revise/version_create/archive |
| 审校 | 4 | review_round1/round2/round3/round4 |
| 归档 | 4 | summary_create, thread_update, timeline_event_create, arc_summary_create |
| 知识库 | 4 | knowledge_read/write, lesson_learn/read |
| 分析 | 2 | analysis_run, analysis_read |

#### 工具接口规范

所有工具遵循统一 input/output 格式：

```typescript
// Input: 每个工具有独立 schema（见 v2-s6-mcp-gates.md Section 3）
// Output: 统一格式
interface MCPToolResult {
  ok: boolean;
  data?: any;
  error?: {
    code: "GATE_FAILED" | "NOT_FOUND" | "CONFLICT" | "INTERNAL";
    message: string;
    gate_details?: {
      passed: string[];
      failed: string[];
      suggestions: string[];
    };
  };
}
```

#### MCP 工具详细接口

完整的 47 个工具接口定义见 `docs/v2-s6-mcp-gates.md` Section 3。本 SPEC 不重复，以该文档为准。

### 2.3 门禁机制

门禁在 MCP 工具内部实现，每次调用前检查前置条件。

#### 门禁级别

| 级别 | 行为 | 示例 |
|------|------|------|
| HARD | 不满足则拒绝 + 返回原因 | 写章节前必须有大纲 |
| SOFT | 不满足则警告 + 仍执行 | 创角色建议先有力量体系 |
| INFO | 仅提示 + 执行 | 提醒某子系统未做自洽检查 |

#### 门禁依赖链

```
创意简报 → 基础世界设定 → 力量体系子系统(SOFT)
                        → 角色(≥2主要) → 关系网络 → 大纲
创意简报 → 文风配置
                                              大纲 → Brief → 章节写入
                                              文风 → 章节写入
                                              章节 → 审校通过 → 摘要 → 归档
```

#### 门禁实现原则

1. 全部基于 DB 查询，无内存状态
2. 拒绝时返回具体原因 + 建议动作
3. 幂等：重复调用不产生副作用
4. gate_check 工具供墨衡委派前预检

### 2.4 Agent 配置

10 个 Agent 在 OpenCode config 中定义（不在代码中实现 Agent 逻辑）。

| Agent | 英文 ID | 模型 | 温度 | 可用工具 |
|-------|---------|------|------|----------|
| 墨衡 | moheng | Claude Sonnet 4 | 0.3 | 全部 47 个 + dispatch |
| 灵犀 | lingxi | Claude Sonnet 4 | 0.9 | brainstorm_* |
| 匠心 | jiangxin | Claude Sonnet 4 | 0.5 | world_*, character_*, outline_*, style_* |
| 执笔 | zhibi | Claude Sonnet 4 | 0.5-0.85 | context_assemble, chapter_*, style_read |
| 明镜 | mingjing | Claude Sonnet 4 | 0.2 | review_* |
| 载史 | zaishi | Claude Haiku/Sonnet | 0.3 | summary_*, thread_*, timeline_*, arc_summary_* |
| 博闻 | bowen | Claude Haiku | 0.3 | knowledge_*, lesson_*, world_consistency_check |
| 析典 | xidian | Claude Sonnet 4 | 0.4 | analysis_* |
| 书虫 | shuchong | Claude Haiku | 0.7 | 无写入工具（只读） |
| 点睛 | dianjing | Claude Sonnet 4 | 0.8 | project_update |

**配置存放位置**：OpenCode config 目录（Docker volume 映射），每个 Agent 一个 YAML/JSON 配置文件。

### 2.5 Agent 间委派

墨衡通过 OpenCode `SubtaskPart` 委派子 Agent。通信规则：
- Agent 之间不直接传递消息
- 所有产出写入 DB（通过 MCP 工具）
- 其他 Agent 通过 MCP 查询获取产出

## 3. 验收标准

### Session Manager

- [ ] `getOrCreate` 幂等：相同 (userId, projectId) 返回同一 sessionId
- [ ] `checkHealth` 正确调用 OpenCode `/global/health`
- [ ] `cleanup` 清理超时 session
- [ ] Session 映射持久化（重启后不丢失）

### MCP Server

- [ ] 47 个工具全部实现
- [ ] 每个工具有对应的单元测试（至少 1 成功 + 1 门禁拒绝用例）
- [ ] 工具 output 遵循 `MCPToolResult` 统一格式
- [ ] HARD 门禁不满足时返回 `{ ok: false, error: { code: "GATE_FAILED", ... } }`
- [ ] SOFT 门禁不满足时返回 `{ ok: true, data: ..., warnings: [...] }`

### 门禁机制

- [ ] 门禁依赖链完整实现（见 v2-s6 Section 4）
- [ ] `gate_check` 工具可检查任意 action 的前置条件
- [ ] 门禁全部基于 DB 查询，无内存状态

### Agent 配置

- [ ] 10 个 Agent 配置文件完整（system prompt + model + temperature + tools）
- [ ] 执笔子写手的 9 种风格配置完整
- [ ] 模型覆盖优先级正确：项目级 > 全局偏好 > 风格默认

### 通用

- [ ] `pnpm typecheck` 通过
- [ ] 所有测试通过
- [ ] Docker 容器启动后健康检查通过

## 4. 依赖

- 依赖 `infrastructure` 模块（Docker 容器管理）
- 依赖 `database` 模块（MCP 工具读写 DB）
- 被 `api-routes` 依赖（Chat API 需通过 Session Manager 转发）
- 被 `sse-realtime` 依赖（SSE 事件从 OpenCode 流出）
- 被 `agents` 依赖（Agent 配置）
