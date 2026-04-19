# agents — TASKS

> **模块**：agents

## 任务列表

### T1: 统一文风/子写手命名
- **问题**：~~AGENTS.md 子写手（云墨/剑心/星河等）与 v2-s4-ui-design.md 预设风格（寒刃白描/锦绣铺陈等）不一致~~
- **状态**：✅ 已完成——显示别名已全部移除，统一使用子名（云墨/剑心/星河等），显示格式为"执笔·{子名}"
- **输出**：已修改 AGENTS.md、v2-s3、v2-s4、v2-s11、agents SPEC/DESIGN 全局统一

### T2: 编写 10 个 Agent YAML 配置
- **依赖**：T1
- **输出**：
  - `opencode-config/agents/moheng.yaml`（墨衡：协调器，Sonnet 4，temp 0.3）
  - `opencode-config/agents/lingxi.yaml`（灵犀：脑暴，Sonnet 4，temp 0.9）
  - `opencode-config/agents/jiangxin.yaml`（匠心：设计，Sonnet 4，temp 0.5）
  - `opencode-config/agents/zhibi.yaml`（执笔：写作，Sonnet 4，temp 动态）
  - `opencode-config/agents/mingjing.yaml`（明镜：审校，Sonnet 4，temp 0.2）
  - `opencode-config/agents/zaishi.yaml`（载史：归档，Haiku，temp 0.3）
  - `opencode-config/agents/bowen.yaml`（博闻：知识库，Haiku，temp 0.3）
  - `opencode-config/agents/xidian.yaml`（析典：分析，Sonnet 4，temp 0.4）
  - `opencode-config/agents/shuchong.yaml`（书虫：读者，Haiku，temp 0.7）
  - `opencode-config/agents/dianjing.yaml`（点睛：标题，Sonnet 4，temp 0.8）
- **规则**：
  - 每个 YAML 包含 name/id/model/temperature/max_tokens/system_prompt/tools
  - system_prompt 详细定义角色职责、行为准则、工具使用说明
  - tools 列表严格按 SPEC 2.5 中各 Agent 权限分配
- **验收**：YAML 格式正确，模型/温度/工具权限与 SPEC 一致

### T3: 编写 9 个写手风格 YAML 配置
- **依赖**：T1
- **输出**：
  - `opencode-config/styles/yunmo.yaml`（云墨：默认/万用）
  - `opencode-config/styles/jianxin.yaml`（剑心：仙侠/武侠）
  - `opencode-config/styles/xinghe.yaml`（星河：硬核/太空）
  - `opencode-config/styles/sushou.yaml`（素手：情感/关系）
  - `opencode-config/styles/yanhuo.yaml`（烟火：现代/都市）
  - `opencode-config/styles/anqi.yaml`（暗棋：推理/悬疑）
  - `opencode-config/styles/qingshi.yaml`（青史：朝堂/历史）
  - `opencode-config/styles/yelan.yaml`（夜阑：惊悚/恐怖）
  - `opencode-config/styles/jiexing.yaml`（谐星：轻松/喜剧）
- **规则**：
  - 每个 YAML 包含 name/id/display_name/genre/recommended_model/description/example_paragraph
  - description 必须具体到语言特征、情感处理、节奏感
  - example_paragraph 提供 100-200 字的风格示例
- **验收**：9 个风格 YAML 都存在，描述 + 示例段落质量达标

### T4: 编写 MCP 连接配置
- **输出**：`opencode-config/mcp.json`
- **验收**：JSON 格式正确，MCP Server 路径指向 `packages/mcp-server/dist/index.js`

### T5: 实现门禁规则定义
- **依赖**：opencode-integration T2（GateChecker 核心类已实现）
- **输出**：`packages/mcp-server/src/gates/rules.ts` 完善全部门禁规则
- **规则**：
  - 覆盖 SPEC 2.6 门禁依赖链的所有 HARD/SOFT 规则
  - 最小规则集：
    - `world_setting_create` → HARD: 创意简报已存在
    - `character_create` → HARD: 世界设定已存在; SOFT: 力量体系已定义
    - `outline_create` → HARD: 角色 ≥ 2 个主要 + 关系网络
    - `chapter_write` → HARD: 大纲+Brief+角色状态+文风; SOFT: 世界自洽
    - `chapter_archive` → HARD: 审校通过
    - `review_round2` → HARD: Round 1 已完成
    - `review_round3` → HARD: Round 2 已完成
    - `review_round4` → HARD: Round 3 已完成
- **验收**：规则数量覆盖全部门禁链，单元测试覆盖 HARD 拒绝/SOFT 警告/正常通过

### T6: 实现审校工具（4 个）
- **依赖**：opencode-integration T1（MCP Server 骨架）
- **输出**：`packages/mcp-server/src/tools/review.ts`
  - `review_round1`（AI 味检测）
  - `review_round2`（逻辑一致性）
  - `review_round3`（文学质量）
  - `review_round4`（读者体验）
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
- **输出**：在 `packages/server/src/opencode/` 中实现 `resolveModel()` 函数
- **规则**：项目级覆盖 > 全局偏好 > 风格默认 > Agent YAML 默认
- **验收**：单元测试覆盖 4 级优先级

### T9: 实现温度场景化逻辑
- **输出**：在 `packages/server/src/opencode/` 中实现 `resolveTemperature()` 函数
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
- **输出**：`docker-compose.dev.yml` 中 opencode 容器挂载 `opencode-config/` 和 `packages/mcp-server/`
- **验收**：`docker compose up` 后 opencode 容器启动健康，MCP Server 可连接

### T12: 端到端集成验证
- **依赖**：T1-T11
- **输出**：
  - 启动全栈（postgres + opencode + server + web）
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
