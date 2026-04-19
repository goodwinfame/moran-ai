# agents — TASKS

> **模块**：agents

## 任务列表

### T1: 统一文风/子写手命名
- **问题**：~~AGENTS.md 子写手（云墨/剑心/星河等）与 v2-s4-ui-design.md 预设风格（寒刃白描/锦绣铺陈等）不一致~~
- **状态**：✅ 已完成——显示别名已全部移除，统一使用子名（云墨/剑心/星河等），显示格式为"执笔·{子名}"
- **输出**：已修改 AGENTS.md、v2-s3、v2-s4、v2-s11、agents SPEC/DESIGN 全局统一

### T2: 编写 10 个 Agent Markdown 配置
- **依赖**：T1
- **输出**：
  - `agents/moheng.md`（墨衡：协调器，Sonnet 4，temp 0.3）
  - `agents/lingxi.md`（灵犀：脑暴，Sonnet 4，temp 0.9）
  - `agents/jiangxin.md`（匠心：设计，Sonnet 4，temp 0.5）
  - `agents/zhibi.md`（执笔：写作，Sonnet 4，temp 动态）
  - `agents/mingjing.md`（明镜：审校，Sonnet 4，temp 0.2）
  - `agents/zaishi.md`（载史：归档，Haiku，temp 0.3）
  - `agents/bowen.md`（博闻：知识库，Haiku，temp 0.3）
  - `agents/xidian.md`（析典：分析，Sonnet 4，temp 0.4）
  - `agents/shuchong.md`（书虫：读者，Haiku，temp 0.7）
  - `agents/dianjing.md`（点睛：标题，Sonnet 4，temp 0.8）
- **规则**：
  - Markdown frontmatter 包含 description/model/temperature/tools
  - model 带 provider 前缀（如 `anthropic/claude-sonnet-4-20250514`）
  - tools 使用 map 格式（`moran-mcp_{tool}: true`）
  - `---` 后的 Markdown 正文为 system_prompt，详细定义角色职责、行为准则、工具使用说明
  - tools 列表严格按 SPEC 2.5 中各 Agent 权限分配
- **验收**：Markdown frontmatter 格式正确，模型/温度/工具权限与 SPEC 一致

### T3: 编写 9 个写手风格 DB 种子数据
- **依赖**：T1
- **输出**：`packages/core/src/db/seed/styles.ts`（seed 脚本，写入 `style_configs` 表）
  - 云墨（默认/万用）
  - 剑心（仙侠/武侠）
  - 星河（硬核/太空）
  - 素手（情感/关系）
  - 烟火（现代/都市）
  - 暗棋（推理/悬疑）
  - 青史（朝堂/历史）
  - 夜阑（惊悚/恐怖）
  - 谐星（轻松/喜剧）
- **规则**：
  - 每个风格包含 name/styleId/displayName/recommendedModel/description/exampleParagraph
  - description 必须具体到语言特征、情感处理、节奏感
  - exampleParagraph 提供 100-200 字的风格示例
- **验收**：9 个风格种子数据写入 DB，描述 + 示例段落质量达标

### T4: 编写 MCP 连接配置
- **输出**：`opencode.json`（项目根目录）
- **验收**：JSON 格式正确，MCP Server 路径指向 `packages/mcp-server/dist/index.js`

### T5: 实现门禁规则定义
- **依赖**：opencode-integration T2（GateChecker 核心类已实现）
- **输出**：`packages/mcp-server/src/gates/rules.ts` 完善全部门禁规则
- **规则**：
  - 覆盖 SPEC 2.6 门禁依赖链的所有 HARD/SOFT 规则
  - 所有 `_read` 工具免门禁（见 mcp-tools/SPEC §6.3）
  - 完整门禁规则集：

  **创作流程门禁（依赖链核心）**：

  | 工具 | 级别 | 条件 |
  |------|------|------|
  | `brainstorm_create` | — | 无门禁（创作流程起点） |
  | `world_create` | HARD | 创意简报（brainstorm）已存在 |
  | `character_create` | HARD | 世界设定已存在 |
  | `character_create` | SOFT | 力量体系已定义 |
  | `relationship_create` | HARD | 双方角色均已存在 |
  | `outline_create` | HARD | 角色 ≥ 2 个主要 + 关系网络已建立 |
  | `chapter_create` | HARD | 大纲已存在 + 章节 Brief 已定义 + 角色状态快照 + 文风已配置 |
  | `chapter_create` | SOFT | 世界设定自洽检查 |
  | `review_execute(round=1)` | HARD | 章节已存在且未归档 |
  | `review_execute(round=2)` | HARD | Round 1 已完成 |
  | `review_execute(round=3)` | HARD | Round 2 已完成 |
  | `review_execute(round=4)` | HARD | Round 3 已完成 |
  | `chapter_archive` | HARD | 审校通过（最终轮 ≥ 阈值） |
  | `context_assemble` | HARD | 大纲已存在 + Brief 已定义 + 文风已确定 |

  **归档流程门禁**：

  | 工具 | 级别 | 条件 |
  |------|------|------|
  | `summary_create` | HARD | 章节已归档 |
  | `thread_create` | HARD | 章节已归档 |
  | `timeline_create` | HARD | 章节已归档 |
  | `character_state_create` | HARD | 角色已存在 + 章节已归档 |

  **数据完整性门禁**：

  | 工具 | 级别 | 条件 |
  |------|------|------|
  | `chapter_update` | HARD | 章节已存在且未归档 |
  | `chapter_patch` | HARD | 章节已存在且未归档 |
  | `world_delete` | SOFT | 无角色依赖此设定 |
  | `character_delete` | SOFT | 无活跃线索依赖此角色 |
  | `analysis_execute` | HARD | 章节已存在 |

  **无门禁工具**（除上述规则外的写入工具均无门禁）：
  `project_update`、`brainstorm_update/patch`、`world_update/check/patch`、`character_update/patch`、
  `relationship_update`、`style_create/update`、`outline_update/patch`、
  `knowledge_create/update/delete/patch`、`lesson_create/update`

- **验收**：规则数量覆盖全部门禁链，单元测试覆盖 HARD 拒绝/SOFT 警告/正常通过

### T6: 实现审校工具（1 个）
- **依赖**：opencode-integration T1（MCP Server 骨架）
- **输出**：`packages/mcp-server/src/tools/review.ts`
  - `review_execute`（round=1 AI味检测 / round=2 逻辑一致性 / round=3 文学质量 / round=4 读者体验）
- **规则**：
  - 各轮顺序依赖（Round N 需 Round N-1 完成）
  - 工具负责读取数据 + 保存评分，评审逻辑由明镜 Agent LLM 完成
  - 返回格式统一：round/dimension/score/issues
  - 审校结论合成逻辑（pass/revise/rewrite）
- **验收**：顺序依赖门禁正确，返回格式符合 SPEC

### T7: 实现 context_assemble 核心工具
- **依赖**：opencode-integration T1, T5, T6, T7（大部分写作相关工具）
- **输出**：`packages/mcp-server/src/tools/writing.ts` 中 `context_assemble` 实现
- **规则**：
  - 三种模式：write（完整上下文）/ revise（最小修订上下文）/ rewrite（无旧章节）
  - Token budget 控制（总计不超 32K tokens）
  - 联查：Brief + world + characters + summary + style + lessons + threads + arc
  - HARD 门禁：大纲已存在 + Brief 已定义 + 文风已确定
- **验收**：三种模式返回正确数据结构，token budget 生效

### T8: 实现模型覆盖优先级逻辑
- **输出**：在 `packages/api-server/src/opencode/` 中实现 `resolveModel()` 函数
- **规则**：项目级覆盖 > 全局偏好 > 风格默认 > Agent 配置默认
- **验收**：单元测试覆盖 4 级优先级

### T9: 实现温度场景化逻辑
- **输出**：在 `packages/api-server/src/opencode/` 中实现 `resolveTemperature()` 函数
- **规则**：5 种章节类型对应不同温度范围（日常/战斗/情感/悬疑/高潮）
- **验收**：单元测试覆盖 5 种场景

### T10: 实现 SSE Agent 状态事件推送
- **依赖**：sse-realtime 模块 SSE 基础设施
- **输出**：Agent 状态变更时发送 SSE 事件
- **规则**：
  - 事件类型：`agent.started` / `agent.thinking` / `agent.completed` / `agent.error`
  - 事件数据：agentId, agentName, status, message
  - 墨衡委派子 Agent 时触发 `agent.started`
  - 子 Agent 完成时触发 `agent.completed`
- **验收**：前端 AgentStatusBar 可消费事件

### T11: Docker Compose 更新
- **依赖**：T2, T3, T4
- **输出**：`docker-compose.dev.yml` 中 opencode 容器挂载 `agents/`、`opencode.json` 和 `packages/mcp-server/`
- **验收**：`docker compose up` 后 opencode 容器启动健康，MCP Server 可连接

### T12: 端到端集成验证
- **依赖**：T1-T11
- **输出**：
  - 启动全栈（postgres + opencode + api-server + web）
  - 验证墨衡可以响应用户消息
  - 验证灵犀可被委派执行脑暴
  - 验证门禁拒绝非法操作
  - `pnpm typecheck` + `pnpm test` 通过
- **验收**：核心创作路径可走通（脑暴→设定→角色 至少前 3 步）

## 依赖关系

```
T1 ──→ T2 ──→ T11 ──→ T12
 │      T3 ──→ T11
 │      T4 ──→ T11
T5 ──→ T6 ──→ T7 ──→ T12
T8 ──→ T12
T9 ──→ T12
T10 ──→ T12
```

T1 统一命名（前提）。T2/T3/T4 配置文件可并行。T5-T7 门禁+审校+上下文组装串行依赖。T8/T9 独立逻辑。T10 SSE 集成。T11 Docker 挂载。T12 最终验证。

**跨模块依赖**：
- T5-T7 依赖 opencode-integration 模块的 MCP Server 骨架（T1-T2）
- T10 依赖 sse-realtime 模块的 SSE 基础设施
- T11 依赖 opencode-integration 模块的 Docker 配置（T14）
- 所有 MCP 工具依赖 database 模块的 Drizzle schema
