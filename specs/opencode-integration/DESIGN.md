# opencode-integration — DESIGN

> **状态**：已完成
> **模块**：opencode-integration

## 1. 当前状态

| 组件 | 状态 | V2 改动 |
|------|------|---------|
| `OpenCodeSessionManager` | ✅ 可用 | 增强：持久化 session 映射到 DB |
| MCP Server | ❌ 不存在 | 全新构建：54 个工具 + 门禁 |
| Agent 配置 | ❌ 不存在 | 全新构建：10 Agent Markdown 配置（`agents/*.md`） |
| Docker 容器 | ✅ 可用 | 挂载 MCP Server 代码 |

## 2. 技术方案

### 2.1 Session Manager 增强

现有 `opencode/manager.ts` 使用内存 Map 存储 session 映射。V2 增强：

#### 2.1.1 持久化决策：保持内存 Map

**理由**：
- 单实例部署（不需要跨进程共享）
- Session 映射是可重建数据（OpenCode SDK 可查询现有 sessions）
- 避免引入 Redis 依赖
- 服务重启时通过 OpenCode SDK `session.list()` 恢复映射

#### 2.1.2 增强接口

```typescript
// 在现有 OpenCodeSessionManager 基础上新增：
export class OpenCodeSessionManager {
  // 现有方法保持不变...

  /** 服务重启时恢复 session 映射 */
  async restore(): Promise<number>;

  /** 获取指定 session 的消息历史 */
  async getMessages(
    sessionId: string,
    options?: { limit?: number; before?: string }
  ): Promise<Message[]>;

  /** 向 session 发送消息（代理前端请求） */
  async sendMessage(
    sessionId: string,
    message: string,
    attachments?: Attachment[]
  ): Promise<{ messageId: string }>;

  /** 订阅 session 事件流（返回 AsyncIterable） */
  subscribeEvents(sessionId: string): AsyncIterable<OpenCodeEvent>;
}
```

### 2.2 MCP Server 架构

#### 2.2.1 包结构决策

**方案**：新建 `packages/mcp-server/` 包（v2-s2-architecture.md 已规划）。

```
packages/mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              ← MCP Server 启动入口
│   ├── server.ts             ← MCP Server 实例创建
│   ├── gates/
│   │   ├── index.ts          ← 门禁统一导出
│   │   ├── checker.ts        ← GateChecker 核心类
│   │   └── rules.ts          ← 门禁规则定义
│   ├── tools/
│   │   ├── index.ts          ← 工具统一注册
│   │   ├── project.ts        ← project_read, project_update, gate_check
│   │   ├── brainstorm.ts     ← brainstorm_create/read/update/patch
│   │   ├── world.ts          ← world_* (6 工具)
│   │   ├── character.ts      ← character_*, character_state_*, relationship_* (10 工具)
│   │   ├── writing.ts        ← style_*, outline_*, chapter_* (13 工具)
│   │   ├── review.ts         ← review_execute (1 工具)
│   │   ├── archive.ts        ← summary_*, thread_*, timeline_* (7 工具)
│   │   ├── knowledge.ts      ← knowledge_*, lesson_* (8 工具)
│   │   └── analysis.ts       ← analysis_execute/read (2 工具)
│   └── types.ts              ← MCPToolResult 等类型
└── __tests__/
    ├── gates/
    └── tools/
```

#### 2.2.2 MCP Server 技术选型

使用 `@modelcontextprotocol/sdk` 官方 TypeScript SDK：

```typescript
// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export function createMcpServer() {
  const server = new McpServer({
    name: "moran-mcp",
    version: "2.0.0",
  });

  // 注册所有工具
  registerProjectTools(server);
  registerBrainstormTools(server);
  // ... 其他工具组

  return server;
}
```

#### 2.2.3 工具实现模式

每个工具文件导出注册函数，MCP 工具是薄壳——解析参数 → 调 Service → 格式化 MCP 响应：

```typescript
// src/tools/project.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { projectService } from "@moran/core/services";
import type { MCPToolResult } from "../types.js";

export function registerProjectTools(server: McpServer) {
  server.tool(
    "project_read",
    "获取项目详情和当前阶段",
    { projectId: z.string().uuid() },
    async ({ projectId }): Promise<MCPToolResult> => {
      const result = await projectService.getById(projectId);
      if (!result.ok) return { ok: false, error: { code: "NOT_FOUND", message: result.error.message } };
      return { ok: true, data: result.data };
    },
  );

  server.tool(
    "gate_check",
    "检查指定操作的门禁前置条件",
    {
      projectId: z.string().uuid(),
      action: z.string(),
      params: z.record(z.any()).optional(),
    },
    async ({ projectId, action, params }) => {
      const result = await gateService.check(projectId, action, params);
      return result;
    },
  );
}
```

### 2.3 门禁系统设计

#### 2.3.1 GateChecker 核心类

```typescript
// src/gates/checker.ts
export class GateChecker {
  constructor(private db: ReturnType<typeof getDb>) {}

  async check(
    projectId: string,
    action: string,
    params?: Record<string, unknown>,
  ): Promise<MCPToolResult> {
    const rules = getGateRules(action);
    const passed: string[] = [];
    const failed: string[] = [];
    const suggestions: string[] = [];

    for (const rule of rules) {
      const result = await rule.evaluate(this.db, projectId, params);
      if (result.passed) {
        passed.push(rule.name);
      } else {
        if (rule.level === "HARD") {
          failed.push(rule.name);
          suggestions.push(result.suggestion);
        }
        // SOFT/INFO: 记录但不阻断
      }
    }

    if (failed.length > 0) {
      return {
        ok: false,
        error: {
          code: "GATE_FAILED",
          message: `前置条件不满足: ${failed.join(", ")}`,
          gate_details: { passed, failed, suggestions },
        },
      };
    }

    return { ok: true, data: { passed, warnings: [] } };
  }
}
```

#### 2.3.2 门禁规则定义

```typescript
// src/gates/rules.ts
interface GateRule {
  name: string;
  level: "HARD" | "SOFT" | "INFO";
  evaluate(
    db: DrizzleDB,
    projectId: string,
    params?: Record<string, unknown>,
  ): Promise<{ passed: boolean; suggestion: string }>;
}

// 规则映射表（key = GateAction，与 gate_check 的 action 参数一致）
const GATE_RULES: Record<string, GateRule[]> = {
  "world_design": [
    { name: "创意简报已存在", level: "HARD", evaluate: hasBrainstormBrief },
  ],
  "character_design": [
    { name: "世界设定已存在", level: "HARD", evaluate: hasWorldSetting },
    { name: "力量体系已定义", level: "SOFT", evaluate: hasPowerSystem },
  ],
  "chapter_write": [
    { name: "大纲已存在", level: "HARD", evaluate: hasOutline },
    { name: "Brief已定义", level: "HARD", evaluate: hasBrief },
    { name: "角色状态就绪", level: "HARD", evaluate: hasCharacterStates },
    { name: "文风已确定", level: "HARD", evaluate: hasStyle },
    { name: "世界设定自洽", level: "SOFT", evaluate: worldConsistency },
  ],
  // ... 按 SPEC 中门禁依赖链定义
};
```

### 2.4 Agent 配置设计

#### 2.4.1 配置存放

Agent 配置存放在项目根目录 `agents/` 下，使用 Markdown frontmatter 格式（参见 S11 §4.3）。通过 Docker volume 映射给 OpenCode：

```
agents/
├── moheng.md        ← 墨衡（协调器）
├── lingxi.md        ← 灵犀（脑暴）
├── jiangxin.md      ← 匠心（设计）
├── zhibi.md         ← 执笔（写作 + 9 子写手引用）
├── mingjing.md      ← 明镜（审校）
├── zaishi.md        ← 载史（归档）
├── bowen.md         ← 博闻（知识库）
├── xidian.md        ← 析典（分析）
├── shuchong.md      ← 书虫（读者）
└── dianjing.md      ← 点睛（标题）
```

> **写手风格**不是 Agent 配置，而是 DB 种子数据（`style_configs` 表），通过 seed 脚本写入。

#### 2.4.2 Agent Markdown 配置格式

```markdown
# agents/moheng.md
---
description: "墨衡 — 全流程协调器。用户唯一入口，意图识别与 Agent 委派。"
model: anthropic/claude-sonnet-4-20250514
temperature: 0.3
tools:
  moran-mcp_project_read: true
  moran-mcp_project_update: true
  # ...（完整工具列表见 agents/DESIGN.md §2.2.1）
---

你是墨衡——墨染创作系统的协调器...
（system prompt 正文）
```

```markdown
# agents/lingxi.md
---
description: "灵犀 — 灵感碰撞专家。发散→聚焦→结晶，输出创意简报。"
model: anthropic/claude-sonnet-4-20250514
temperature: 0.9
tools:
  moran-mcp_brainstorm_create: true
  moran-mcp_brainstorm_read: true
  moran-mcp_brainstorm_update: true
  moran-mcp_brainstorm_patch: true
  moran-mcp_project_read: true
---

你是灵犀——墨染创作系统的灵感碰撞专家...
（system prompt 正文）
```

#### 2.4.3 Docker Volume 挂载

```yaml
# docker-compose.dev.yml 新增
opencode:
  volumes:
    - ./agents:/app/agents:ro
    - ./opencode.json:/app/opencode.json:ro
```

### 2.5 新增包和依赖

| 包/模块 | 类型 | 依赖 |
|---------|------|------|
| `packages/mcp-server` | 新包 | `@modelcontextprotocol/sdk`, `@moran/core`, `zod` |

## 3. 不需要改动的部分

- `OpenCodeSessionManager` 的核心逻辑（getOrCreateSession / checkHealth / cleanup）
- Docker Compose 的 PostgreSQL 配置
- Next.js rewrite 代理

## 4. 风险与注意事项

- **MCP Server 是最大模块**：54 个工具 + 门禁逻辑，占 V2 工作量 ~35%
- **OpenCode SDK API 可能变化**：需要查阅最新文档确认 session.prompt / session.messages 等 API
- **Agent system prompt 质量**：直接影响 Agent 行为，需要反复调试
- **门禁全部基于 DB 查询**：如果查询复杂度高，可能影响 MCP 工具响应速度
- **MCP SDK 版本**：确认使用 `@modelcontextprotocol/sdk` 最新稳定版
