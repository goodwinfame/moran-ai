# opencode-integration — TASKS

> **模块**：opencode-integration

## 任务列表

### T1: 创建 mcp-server 包骨架
- **输入**：`packages/` 目录
- **输出**：
  - `packages/mcp-server/package.json`（name: `@moran/mcp-server`）
  - `packages/mcp-server/tsconfig.json`
  - `packages/mcp-server/src/index.ts`
  - `packages/mcp-server/src/server.ts`（McpServer 创建函数）
  - `packages/mcp-server/src/types.ts`（MCPToolResult 等类型）
  - 安装依赖：`@modelcontextprotocol/sdk`, `zod`, `@moran/core`
- **验收**：`pnpm typecheck` 通过，包可被 pnpm workspace 识别

### T2: 实现门禁系统
- **输出**：
  - `src/gates/checker.ts`（GateChecker 核心类）
  - `src/gates/rules.ts`（全部门禁规则定义）
  - `src/gates/index.ts`（统一导出）
  - `__tests__/gates/checker.test.ts`
- **验收**：
  - 门禁依赖链规则完整覆盖（SPEC 2.3 / 2.6 中的所有 HARD/SOFT 规则）
  - GateChecker 单元测试通过（mock DB 查询）
  - 至少 10 个测试用例：覆盖 HARD 拒绝、SOFT 警告、INFO 提示

### T3: 实现项目管理工具（3 个）
- **输出**：`src/tools/project.ts`
  - `project_read`：读取项目详情 + 当前阶段
  - `project_update`：更新项目信息
  - `gate_check`：通用门禁检查器
- **验收**：每个工具有成功 + 门禁拒绝测试用例

### T4: 实现脑暴工具（3 个）
- **输出**：`src/tools/brainstorm.ts`
  - `brainstorm_create`：创建脑暴记录
  - `brainstorm_read`：读取脑暴（按阶段）
  - `brainstorm_update`：更新脑暴
- **验收**：每个工具有测试用例

### T5: 实现世界观工具（5 个）
- **输出**：`src/tools/world.ts`
  - `world_create`：创建世界设定（type="setting" | "subsystem" | "location"）
  - `world_read`：读取世界设定
  - `world_update`：更新世界设定
  - `world_delete`：删除世界设定
  - `world_check`：世界观自洽性检查
- **验收**：每个工具有测试用例，门禁（需创意简报）生效

### T6: 实现角色工具（9 个）
- **输出**：
  - `src/tools/character.ts`
    - `character_create/read/update/delete`
  - `src/tools/character-state.ts`
    - `character_state_create`：创建角色状态快照（不可变）
    - `character_state_read`：读取角色状态
  - `src/tools/relationship.ts`
    - `relationship_create/read/update`
- **验收**：每个工具有测试用例，门禁（需世界设定）生效

### T7: 实现写作准备 + 章节工具（11 个）
- **输出**：
  - `src/tools/style.ts`
    - `style_create/read/update`
  - `src/tools/outline.ts`
    - `outline_create`（type="synopsis" | "arc_detail"）/ `outline_read` / `outline_update`
  - `src/tools/context.ts`
    - `context_assemble`（核心：组装写作上下文）
  - `src/tools/chapter.ts`
    - `chapter_create/read/update/archive`
- **验收**：
  - `context_assemble` 正确组装 brief + world + characters + summary + style + lessons + threads
  - `chapter_create` 门禁链完整检查（大纲 + Brief + 角色 + 文风）
  - 每个工具有测试用例

### T8: 实现审校工具（1 个）
- **输出**：`src/tools/review.ts`
  - `review_execute`（round=1/2/3/4）
    - round 1：AI 味检测
    - round 2：逻辑一致性
    - round 3：文学质量
    - round 4：读者体验
- **验收**：顺序依赖正确（round 2 需 round 1 完成），每轮有测试

### T9: 实现归档工具（7 个）
- **输出**：
  - `src/tools/summary.ts`
    - `summary_create/read`
  - `src/tools/thread.ts`
    - `thread_create/read/update`
  - `src/tools/timeline.ts`
    - `timeline_create/read`
- **验收**：每个工具有测试用例，门禁（需审校通过）生效

### T10: 实现知识库 + 分析工具（9 个）
- **输出**：
  - `src/tools/knowledge.ts`（knowledge_create/read/update/delete）
  - `src/tools/lesson.ts`（lesson_create/read/update）
  - `src/tools/analysis.ts`（analysis_execute/read）
- **验收**：每个工具有测试用例

### T11: MCP Server 集成 — 工具注册 + 启动入口
- **输入**：T3-T10 的工具模块
- **输出**：
  - `src/tools/index.ts`（统一注册函数）
  - `src/server.ts`（完整 MCP Server）
  - `src/index.ts`（Stdio 传输启动）
- **验收**：MCP Server 可启动，所有 48 个工具注册成功

### T12: Session Manager 增强
- **输入**：`packages/server/src/opencode/manager.ts`
- **输出**：
  - `restore()` 方法：服务重启恢复映射
  - `getMessages()` 方法：代理获取消息历史
  - `sendMessage()` 方法：代理发送消息
  - `subscribeEvents()` 方法：代理事件订阅
- **验收**：新方法有测试用例（mock OpenCode SDK）

### T13: Agent 配置文件编写
- **输出**：
  - `opencode-config/agents/` 下 10 个 Agent YAML
  - `opencode-config/styles/` 下 9 个写手风格 YAML
  - `opencode-config/mcp.json`（MCP 连接配置）
- **验收**：YAML 格式正确，模型/温度/工具权限与 SPEC 一致

### T14: Docker Compose 更新
- **输入**：`docker-compose.dev.yml`
- **输出**：OpenCode 容器挂载 `opencode-config/` 和 `packages/mcp-server/`
- **验收**：`docker compose up` 后 MCP Server 可被 OpenCode 连接

### T15: 验证全局构建
- **输入**：T1-T14 完成
- **输出**：`pnpm typecheck` + `pnpm test` 全部通过
- **验收**：零错误

## 依赖关系

```
T1 ──→ T2 ──┐
             ├→ T3 ─┐
             ├→ T4  │
             ├→ T5  │
             ├→ T6  ├→ T11 → T14 → T15
             ├→ T7  │
             ├→ T8  │
             ├→ T9  │
             └→ T10 ┘
T12 ────────────────────→ T15
T13 ──→ T14
```

T1 创建包骨架，T2 门禁系统。T3-T10 各工具组可并行。T11 集成注册。T12 独立可并行。T13 配置文件。T14 Docker 挂载。T15 最终验证。

**注意**：此模块工作量最大（~35% 总量），建议按 T3→T5→T6→T7 顺序优先实现核心路径工具。
