# mcp-tools — DESIGN

> **状态**：已完成
> **模块**：mcp-tools
> **基准文档**：`specs/mcp-tools/SPEC.md`（工具设计规范）

## 1. 模块定位

本模块定义 MCP 工具的**实现模式和技术约束**。工具的实际编码实现在 `opencode-integration` 模块中完成（T3-T10），本模块提供共享的基础设施和一致性保障。

**职责边界**：

| 关注点 | 本模块（mcp-tools） | opencode-integration |
|--------|---------------------|---------------------|
| 工具命名/IO 规范 | ✅ 定义 | 遵守 |
| 基础设施代码（ok/fail/类型） | ✅ 定义 + 实现 | 使用 |
| 门禁规范 | ✅ 定义 | 实现 |
| 54 个工具逐个实现 | ❌ | ✅ T3-T10 |
| 测试策略和模式 | ✅ 定义 | 遵守 |

## 2. 技术方案

### 2.1 工具注册模式

每个域文件导出一个注册函数，接收 `McpServer` 实例。所有工具在 `tools/index.ts` 中统一注册：

```typescript
// tools/index.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProjectTools } from "./project.js";
import { registerBrainstormTools } from "./brainstorm.js";
// ... 其余 16 个域

export function registerAllTools(server: McpServer) {
  registerProjectTools(server);
  registerBrainstormTools(server);
  // ... 按域顺序注册（与 SPEC §7 表格顺序一致）
}
```

**注册函数命名**：`register{Domain}Tools`（PascalCase 域名）。

### 2.2 MCP 工具实现三层模式

每个 MCP 工具是**薄壳**——不包含业务逻辑：

```
MCP 工具层（解析参数 → 调 Service → 格式化响应）
    ↓
Service 层（@moran/core/services → 业务逻辑 + DB 操作）
    ↓
DB 层（Drizzle ORM → PostgreSQL）
```

```typescript
// 标准工具实现模板
server.tool(
  "domain_action",           // 1. 工具名（{domain}_{action}）
  "中文描述",                 // 2. 工具描述（供 LLM 理解）
  {                           // 3. Zod input schema
    projectId: z.string(),
    // ... 其余参数
  },
  async (params) => {         // 4. 处理函数
    // 4a. [可选] 门禁检查
    const gateResult = await gateChecker.check(projectId, "domain_action", params);
    if (!gateResult.ok) return fail(gateResult.error.code, gateResult.error.message, gateResult.error.details);

    // 4b. 调用 Service 层
    const result = await domainService.action(params);

    // 4c. 返回标准格式
    if (!result.ok) return fail(result.error.code, result.error.message);
    return ok(result.data);
  },
);
```

### 2.3 响应格式化工具函数

```typescript
// src/utils/response.ts
export function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ ok: true, data }) }],
  };
}

export function fail(code: string, message: string, details?: object) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: { code, message, ...( details ? { details } : {}) } }) }],
  };
}
```

所有工具**必须**使用 `ok()` / `fail()` 返回——禁止直接拼 JSON 字符串。

### 2.4 Patch 工具实现模式

6 个 `_patch` 工具共享 find/replace 语义：

```typescript
// 标准 patch 输入 schema
const patchInput = z.object({
  projectId: z.string(),
  entityId: z.string(),       // 目标实体 ID
  patches: z.array(z.object({
    find: z.string(),          // 要替换的文本片段
    replace: z.string(),       // 替换为的新文本
  })),
});

// 标准 patch 实现逻辑
async function applyPatches(content: string, patches: PatchItem[]): Promise<{ content: string; applied: number; failed: string[] }> {
  let result = content;
  let applied = 0;
  const failed: string[] = [];

  for (const patch of patches) {
    if (result.includes(patch.find)) {
      result = result.replace(patch.find, patch.replace);
      applied++;
    } else {
      failed.push(patch.find);
    }
  }

  return { content: result, applied, failed };
}
```

**Patch 规则**：
- 每次 `find` 仅替换**首次匹配**（非全局替换），避免意外多处修改
- 所有 patch 失败项记录在返回值 `failed` 数组中
- 即使部分 patch 失败，已成功的 patch 仍然保存
- Patch 工具受门禁保护：目标实体必须存在且未归档（chapter_patch 需检查 archived 状态）

### 2.5 门禁集成模式

门禁检查在工具函数**开头**执行，写入工具内联调用 `GateChecker`：

```typescript
// 写入工具中的门禁集成
server.tool("world_create", "创建世界设定", schema, async (params) => {
  // 1. 门禁检查（内联，不走 gate_check 工具）
  const gate = await gateChecker.check(params.projectId, "world_create");
  if (!gate.ok) return fail("GATE_FAILED", gate.error.message, gate.error.details);

  // 2. 业务逻辑
  const result = await worldService.create(params);
  return result.ok ? ok(result.data) : fail(result.error.code, result.error.message);
});
```

**门禁豁免**：
- 所有 `_read` 工具：免门禁（SPEC §6.3）
- `brainstorm_create`：免门禁（创作流程起点）
- `project_update`：免门禁
- `style_create/update`：免门禁
- `knowledge_*`（写入）：免门禁
- `lesson_*`（写入）：免门禁

### 2.6 Service 层调用约定

MCP 工具**不直接操作 DB**，必须通过 `@moran/core/services` 中的 Service 函数。

```typescript
// MCP 工具中的 Service 调用
import { characterService } from "@moran/core/services";

// Service 函数返回统一 Result 类型
type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
```

**Service 层职责**：
- 参数校验（二次校验，补充 Zod 无法覆盖的业务规则）
- DB 操作（Drizzle ORM）
- 事务管理（多表操作用 `db.transaction()`）
- 返回 `ServiceResult<T>` 给工具层

### 2.7 错误码使用规范

| 场景 | 错误码 | 说明 |
|------|--------|------|
| 门禁前置条件不满足 | `GATE_FAILED` | 附带 `details: { passed, failed, suggestions }` |
| 按 ID 查询无结果 | `NOT_FOUND` | 工具描述指定了 ID 但找不到 |
| 唯一约束冲突 | `CONFLICT` | 重复创建已存在实体 |
| Zod 校验失败 | `VALIDATION` | MCP SDK 自动处理，通常不需要手动返回 |
| DB 异常 | `INTERNAL` | 捕获 DB 错误，不暴露细节给 Agent |

### 2.8 测试策略

#### 2.8.1 单元测试

每个工具至少 2 个测试用例：1 个成功 + 1 个失败（门禁拒绝/NOT_FOUND）。

```typescript
// __tests__/tools/character.test.ts
import { describe, it, expect, vi } from "vitest";

describe("character_create", () => {
  it("should create character when world setting exists", async () => {
    // mock Service 返回成功
    vi.spyOn(characterService, "create").mockResolvedValue({
      ok: true, data: { id: "chr_123" },
    });
    // mock 门禁通过
    vi.spyOn(gateChecker, "check").mockResolvedValue({ ok: true, data: { passed: ["世界设定已存在"] } });

    const result = await callTool("character_create", { projectId: "proj_1", name: "张三", ... });
    expect(JSON.parse(result.content[0].text)).toEqual({ ok: true, data: { id: "chr_123" } });
  });

  it("should reject when world setting is missing", async () => {
    vi.spyOn(gateChecker, "check").mockResolvedValue({
      ok: false, error: { code: "GATE_FAILED", message: "前置条件不满足", details: { failed: ["世界设定已存在"] } },
    });

    const result = await callTool("character_create", { projectId: "proj_1", ... });
    const body = JSON.parse(result.content[0].text);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("GATE_FAILED");
  });
});
```

#### 2.8.2 测试辅助工具

```typescript
// __tests__/helpers.ts
import { createMcpServer } from "../src/server.js";

/** 直接调用注册好的工具，绕过 MCP 传输层 */
export async function callTool(name: string, args: Record<string, unknown>) {
  const server = createMcpServer();
  return server.callTool(name, args);
}
```

不启动真实 Stdio 传输，直接调用 `server.callTool()` 进行测试。

#### 2.8.3 测试覆盖要求

| 测试类型 | 覆盖范围 | 数量估算 |
|----------|---------|---------|
| 门禁规则 | 每条 HARD 规则至少 2 用例（通过/拒绝） | ~30 |
| 工具成功路径 | 每个工具 1 个成功用例 | 54 |
| 工具失败路径 | 每个写入工具 1 个失败用例 | ~35 |
| Patch 工具 | find 命中/未命中/部分命中 | 6×3=18 |
| **合计估算** | | ~137 |

## 3. 文件组织

遵循 SPEC §9（一域一文件）。详见 SPEC §9.1 的文件列表。

实际实现代码位于 `packages/mcp-server/src/tools/`，由 `opencode-integration` 模块 T3-T10 完成。

本模块提供的共享基础设施文件：

```
packages/mcp-server/src/
├── types.ts                  ← MCPToolResult 类型定义
├── utils/
│   └── response.ts           ← ok() / fail() 工具函数
│   └── patch.ts              ← applyPatches() 共享 patch 逻辑
```

## 4. 风险与注意事项

- **LLM 参数填充准确率**：复杂嵌套 input schema 降低准确率。遵循 SPEC §3.4（JSON 字符串扁平化）。
- **Patch 冲突**：多个 Agent 同时 patch 同一实体可能覆盖。MVP 不处理，依赖 OpenCode 的顺序执行。
- **门禁查询性能**：每次写入工具都触发 DB 查询。MVP 接受，后续可加缓存。
- **MCP SDK 工具名限制**：确认 SDK 是否支持下划线命名（已验证支持）。
