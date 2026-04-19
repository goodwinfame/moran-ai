# mcp-tools — TASKS

> **模块**：mcp-tools
> **说明**：本模块定义 MCP 工具的**共享基础设施**任务。54 个工具的逐域实现在 `opencode-integration` 模块 T3-T10 中完成。

## 任务列表

### T1: 实现 MCP 响应工具函数
- **输出**：
  - `packages/mcp-server/src/utils/response.ts`
    - `ok(data)` — 标准成功响应
    - `fail(code, message, details?)` — 标准失败响应
  - `packages/mcp-server/src/types.ts`
    - `MCPToolResult` 类型定义
    - `ErrorCode` 枚举类型（`GATE_FAILED | NOT_FOUND | CONFLICT | VALIDATION | INTERNAL`）
    - `ServiceResult<T>` 类型（Service 层统一返回类型）
- **验收**：
  - `ok()` 输出 `{ content: [{ type: "text", text: JSON.stringify({ ok: true, data }) }] }`
  - `fail()` 输出包含 `{ ok: false, error: { code, message } }`
  - 类型定义通过 `pnpm typecheck`
  - 单元测试覆盖 ok/fail 序列化

### T2: 实现 Patch 共享逻辑
- **输出**：`packages/mcp-server/src/utils/patch.ts`
  - `applyPatches(content, patches[])` 函数
  - 返回 `{ content, applied, failed }` 结构
- **规则**：
  - 每次 `find` 仅替换首次匹配
  - 部分失败不阻断——已成功的 patch 保留
  - 失败项返回在 `failed` 数组中
- **验收**：
  - 全部命中：applied = patches.length, failed = []
  - 部分命中：applied = N, failed 列出未命中的 find 值
  - 全部未命中：applied = 0, failed = 全部 find 值
  - 空 patches 数组：返回原内容不变

### T3: 实现工具统一注册入口
- **依赖**：opencode-integration T3-T10（各域工具已实现）
- **输出**：`packages/mcp-server/src/tools/index.ts`
  - `registerAllTools(server)` 函数
  - 按 SPEC §7 域顺序注册 18 个域
- **验收**：
  - 导入所有 18 个域的注册函数
  - 注册后 54 个工具可通过 `server.callTool()` 调用
  - `pnpm typecheck` 通过

### T4: 工具命名合规性验证
- **依赖**：T3
- **输出**：`packages/mcp-server/__tests__/compliance/naming.test.ts`
- **规则**：
  - 所有 54 个工具名符合 `{domain}_{action}` 格式
  - 所有 action 来自 SPEC §2.2 标准动词集
  - 无禁止动词（SPEC §2.3）
  - 域名不超过 2 个单词
- **验收**：合规性测试通过

### T5: CRUD 对称性验证
- **依赖**：T3
- **输出**：`packages/mcp-server/__tests__/compliance/crud-symmetry.test.ts`
- **规则**：
  - 所有可写域有对应 `_read` 工具
  - 完整 CRUD 域（world, character, knowledge）有 create/read/update/delete
  - CRU 域（brainstorm, style, outline 等）有 create/read/update
  - 跨 Agent 共享域有完整读写对
- **验收**：对称性测试通过

### T6: 门禁覆盖率验证
- **依赖**：opencode-integration T2（GateChecker 已实现）
- **输出**：`packages/mcp-server/__tests__/compliance/gate-coverage.test.ts`
- **规则**：
  - 每个写入工具有明确的门禁定义或"无门禁"标注
  - 所有 `_read` 工具无门禁
  - 创作流程依赖链门禁完整（brainstorm → world → character → outline → chapter → review → archive）
  - 归档流程门禁完整（summary/thread/timeline/character_state 需 chapter_archived）
- **验收**：覆盖率测试通过

### T7: 输出格式一致性验证
- **依赖**：T3
- **输出**：`packages/mcp-server/__tests__/compliance/output-format.test.ts`
- **规则**：
  - 所有工具成功返回包含 `{ ok: true, data }`
  - 所有工具失败返回包含 `{ ok: false, error: { code, message } }`
  - 创建操作 `data` 包含 `{ id: string }`
  - 错误码来自标准枚举（SPEC §4.2）
- **验收**：格式一致性测试通过

## 依赖关系

```
T1 ──→ T2 ──→ T3 ──→ T4
                ├──→ T5
                ├──→ T6
                └──→ T7
```

T1 基础类型和工具函数。T2 Patch 共享逻辑。T3 统一注册入口（依赖 opencode-integration T3-T10 各域实现完成）。T4-T7 合规性验证可并行。

**跨模块依赖**：
- T3 依赖 `opencode-integration` T3-T10（各域工具注册函数已实现）
- T6 依赖 `opencode-integration` T2（GateChecker 核心类）
- T1-T2 被 `opencode-integration` T3-T10 消费（工具实现导入 ok/fail/applyPatches）

**实现顺序建议**：先完成 T1-T2（被各域工具依赖），再由 opencode-integration 实现各域工具，最后 T3 统一注册 + T4-T7 验证。
