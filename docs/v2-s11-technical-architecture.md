# S11 — 技术方案设计

> **状态**：已完成  
> **定位**：填补产品设计（S1–S10）与 SDD Spec 之间的技术决策空白。  
> **原则**：S2 回答"系统长什么样"，本文回答"系统怎么造"。

---

## 目录

1. [总览](#1-总览)
2. [服务拓扑与部署](#2-服务拓扑与部署)
3. [MCP Server 技术方案](#3-mcp-server-技术方案)
4. [OpenCode 集成技术方案](#4-opencode-集成技术方案)
5. [数据访问层](#5-数据访问层)
6. [实时事件系统](#6-实时事件系统)
7. [认证与安全](#7-认证与安全)
8. [错误处理与恢复](#8-错误处理与恢复)
9. [对已有 Spec 的影响](#9-对已有-spec-的影响)

---

## 1. 总览

### 1.1 本文档的必要性

S2（架构总览）用 Mermaid 方块图描述了系统的逻辑拓扑和数据流向——"浏览器 → Next.js → Hono → OpenCode → MCP → DB"。但它没有回答以下问题：

- MCP Server 是独立进程还是子进程？用什么传输协议？
- OpenCode SDK 的实际 API 长什么样？Session 怎么持久化？
- 两条 DB 访问路径（MCP 写 + Hono 读）怎么隔离？连接池怎么管？
- 从 Agent 写入 DB 到前端面板刷新，端到端事件链路怎么走？
- 认证模型是什么？MCP 工具内怎么拿到用户身份？

本文逐一回答。所有技术决策附理由，供 SDD Spec 实现时直接引用。

### 1.2 决策索引

| # | 决策 | 结论 | 章节 |
|---|------|------|------|
| D1 | MCP 传输协议 | stdio（OpenCode 子进程） | §3.1 |
| D2 | MCP Server 包位置 | `packages/mcp-server/` | §3.2 |
| D3 | MCP DB 访问方式 | 直接 Drizzle，导入 `@moran/core` | §3.4 |
| D4 | Agent 配置格式 | Markdown frontmatter（`agents/*.md`） | §4.3 |
| D5 | OpenCode 项目配置 | `opencode.json` 声明 MCP Server | §4.1 |
| D6 | 数据写入路径 | 唯一：Agent → MCP → Gate → Drizzle → PG | §5.1 |
| D7 | 数据读取路径 | 双通道：面板走 Hono，Agent 走 MCP | §5.2 |
| D8 | 连接池策略 | 两个独立池（Hono 进程 + MCP 进程） | §5.3 |
| D9 | 面板更新触发 | MCP 写入 → OpenCode SSE → Hono 变换 → 前端 SSE | §6 |
| D10 | 认证模型 | MVP：`x-user-id` header，无真实 auth | §7 |
| D11 | MCP 内用户身份 | `projectId` 参数隐式绑定，不传 userId | §7.3 |

---

## 2. 服务拓扑与部署

### 2.1 进程模型

```
┌─────────────────────────────────────────────────────────┐
│  Host Machine (开发者本机)                                │
│                                                         │
│  ┌─ Node.js 进程 A ──────────────────────────────────┐  │
│  │  Next.js (:3000)                                  │  │
│  │  • 静态资源 / SSR                                  │  │
│  │  • Auth 中间件                                     │  │
│  │  • Rewrite /api/* → localhost:3200                 │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ Node.js 进程 B ──────────────────────────────────┐  │
│  │  Hono Server (:3200)                              │  │
│  │  • Chat API（代理 OpenCode SSE）                    │  │
│  │  • Panel API（读 PostgreSQL）                       │  │
│  │  • SSE 广播（EventTransformer → SSEBroadcaster）    │  │
│  │  • OpenCodeSessionManager 单例                     │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ Docker ─────────────────────────────────────────┐   │
│  │                                                   │   │
│  │  ┌─ Container: opencode ───────────────────────┐  │   │
│  │  │  OpenCode serve (:4096)                     │  │   │
│  │  │  • Session 管理（SQLite 持久化）              │  │   │
│  │  │  • Agent 调度（墨衡 → SubtaskPart → 子Agent） │  │   │
│  │  │  • LLM Provider 调用                        │  │   │
│  │  │  │                                          │  │   │
│  │  │  └── stdio ──► MCP Server (子进程)           │  │   │
│  │  │                • 48 个工具 + 门禁             │  │   │
│  │  │                • Drizzle → PostgreSQL         │  │   │
│  │  └────────────────────────────────────────────┘  │   │
│  │                                                   │   │
│  │  ┌─ Container: postgres ───────────────────────┐  │   │
│  │  │  PostgreSQL 17 (:5432)                      │  │   │
│  │  │  • 30+ 表 Drizzle Schema                    │  │   │
│  │  └────────────────────────────────────────────┘  │   │
│  │                                                   │   │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**5 个运行单元**：

| 单元 | 类型 | 端口 | 职责 |
|------|------|------|------|
| Next.js | Host 进程 | 3000 | 页面渲染、静态资源、Rewrite 代理 |
| Hono Server | Host 进程 | 3200 | 业务 API、SSE 广播、Session 管理 |
| OpenCode serve | Docker 容器 | 4096 | AI 引擎、Agent 调度、Session 持久化 |
| MCP Server | OpenCode 子进程 | — (stdio) | DB 工具、门禁逻辑 |
| PostgreSQL | Docker 容器 | 5432 | 数据存储 |

### 2.2 网络通信矩阵

```
                Next.js    Hono     OpenCode    MCP      PostgreSQL
Next.js           —       HTTP       —          —          —
Hono              —        —        HTTP/SSE    —         TCP
OpenCode          —        —         —        stdio       —
MCP               —        —         —          —         TCP
PostgreSQL        —        —         —          —          —
```

关键路径：
- **浏览器 → Next.js → Hono**：HTTP（Next.js rewrite 同源代理，消除 CORS）
- **Hono → OpenCode**：HTTP REST + SSE（`@opencode-ai/sdk`）
- **OpenCode → MCP**：stdio（标准输入/输出，JSON-RPC over stdin/stdout）
- **Hono → PostgreSQL**：TCP（Drizzle ORM，直连）
- **MCP → PostgreSQL**：TCP（Drizzle ORM，直连，独立连接池）

### 2.3 Docker Compose（开发环境）

当前 `docker-compose.dev.yml` 只有 `postgres` 和 `opencode` 两个 service。V2 需要增强 `opencode` 容器以支持 MCP Server：

```yaml
# docker-compose.dev.yml（V2 增强）
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: moran
      POSTGRES_USER: moran
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-moran_dev_password}
    volumes:
      - pgdata-dev:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U moran"]
      interval: 5s
      timeout: 5s
      retries: 5

  opencode:
    image: ghcr.io/anomalyco/opencode:latest
    command: ["serve", "--hostname", "0.0.0.0", "--port", "4096"]
    ports:
      - "4096:4096"
    volumes:
      # Auth 凭据（只读）
      - ${USERPROFILE}/.local/share/opencode/auth.json:/root/.local/share/opencode/auth.json:ro
      # MCP Server 代码（开发时热重载需要）
      - ./packages/mcp-server/dist:/app/mcp-server:ro
      # OpenCode 项目配置（Agent 定义 + MCP 声明）
      - ./opencode.json:/app/opencode.json:ro
      - ./.opencode:/app/.opencode:ro
    working_dir: /app
    environment:
      - DATABASE_URL=postgresql://moran:${POSTGRES_PASSWORD:-moran_dev_password}@postgres:5432/moran
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://127.0.0.1:4096/global/health || exit 1"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s

volumes:
  pgdata-dev:
```

**V2 新增挂载**（对比现有 dev.yml）：
1. `./packages/mcp-server/dist:/app/mcp-server:ro` — MCP Server 编译产物
2. `./opencode.json:/app/opencode.json:ro` — OpenCode 配置（声明 MCP Server + Agent）
3. `./.opencode:/app/.opencode:ro` — Agent Markdown 配置目录
4. `DATABASE_URL` 环境变量 — MCP Server 连接 PostgreSQL 需要
5. `depends_on: postgres` — 确保 DB 先于 OpenCode 启动

### 2.4 环境变量

| 变量 | 使用方 | 说明 |
|------|--------|------|
| `DATABASE_URL` | Hono + MCP | PostgreSQL 连接串 |
| `OPENCODE_BASE_URL` | Hono | OpenCode serve 地址（默认 `http://127.0.0.1:4096`） |
| `PORT` | Hono | HTTP 监听端口（默认 `3200`） |
| `API_UPSTREAM` | Next.js | Rewrite 目标（默认 `http://localhost:3200`） |
| `POSTGRES_PASSWORD` | Docker | PostgreSQL 密码（默认 `moran_dev_password`） |

> MCP Server 不需要独立端口——它通过 stdio 与 OpenCode 通信，通过 `DATABASE_URL`（由 OpenCode 容器环境变量注入）访问 PostgreSQL。

---

## 3. MCP Server 技术方案

### 3.1 传输协议：stdio（决策 D1）

MCP 协议支持两种传输：

| 传输 | 进程模型 | 适用场景 |
|------|----------|----------|
| **stdio** | 父进程 spawn 子进程，通过 stdin/stdout 通信 | 单客户端、嵌入式 |
| **Streamable HTTP** | 独立 HTTP 服务，多客户端连接 | 多客户端、可独立扩展 |

**选择 stdio 的理由**：

1. **唯一客户端**：MCP Server 只有一个消费者——OpenCode serve。不需要多客户端支持。
2. **生命周期绑定**：OpenCode 启动时 spawn MCP Server，关闭时自动终止。无需独立管理进程。
3. **零网络配置**：无需分配端口、处理连接超时、实现重连逻辑。
4. **OpenCode 原生支持**：OpenCode 的 `opencode.json` 直接声明 stdio MCP Server，无需额外适配。
5. **MVP 最简**：未来如果需要多实例部署，可迁移到 Streamable HTTP，但 MVP 阶段不需要。

**迁移成本评估**：stdio → HTTP 的改动仅限 `src/index.ts` 入口文件（替换 `StdioServerTransport` 为 `StreamableHTTPServerTransport`），工具代码不受影响。

### 3.2 包结构（决策 D2）

```
packages/mcp-server/
├── package.json                 # name: @moran/mcp-server
├── tsconfig.json                # extends ../../tsconfig.base.json
├── src/
│   ├── index.ts                 # 入口：创建 server + 连接 stdio transport
│   ├── server.ts                # McpServer 实例创建 + 全部工具注册
│   ├── db.ts                    # Drizzle 客户端（导入 @moran/core schema）
│   ├── gates/
│   │   ├── index.ts             # GateChecker 导出
│   │   ├── checker.ts           # GateChecker 核心类
│   │   └── rules.ts             # 所有门禁规则定义（phase → required conditions）
│   ├── tools/
│   │   ├── index.ts             # 统一注册函数 registerAllTools(server)
│   │   ├── project.ts           # project_read, project_update, gate_check
│   │   ├── brainstorm.ts        # brainstorm_create, brainstorm_read, brainstorm_update
│   │   ├── world.ts             # world_create, world_read, world_update, world_delete, world_check
│   │   ├── character.ts         # character_create, character_read, character_update, character_delete
│   │   ├── character-state.ts   # character_state_create, character_state_read
│   │   ├── relationship.ts      # relationship_create, relationship_read, relationship_update
│   │   ├── style.ts             # style_create, style_read, style_update
│   │   ├── outline.ts           # outline_create, outline_read, outline_update
│   │   ├── chapter.ts           # chapter_create, chapter_read, chapter_update, chapter_archive
│   │   ├── review.ts            # review_execute
│   │   ├── summary.ts           # summary_create, summary_read
│   │   ├── thread.ts            # thread_create, thread_read, thread_update
│   │   ├── timeline.ts          # timeline_create, timeline_read
│   │   ├── knowledge.ts         # knowledge_create, knowledge_read, knowledge_update, knowledge_delete
│   │   ├── lesson.ts            # lesson_create, lesson_read, lesson_update
│   │   ├── analysis.ts          # analysis_execute, analysis_read
│   │   └── context.ts           # context_assemble
│   └── utils/
│       ├── response.ts          # 统一响应格式 { ok, data?, reason? }
│       └── context.ts           # projectId 提取 + 公共查询
```

**依赖关系**：

```
@moran/mcp-server
  └── @moran/core          # DB schema、类型定义、枚举
  └── @modelcontextprotocol/sdk   # MCP 协议 SDK
  └── drizzle-orm           # DB 访问（@moran/core 已包含）
  └── zod                   # 工具输入校验（MCP SDK 要求 Zod v4）
```

> `@moran/mcp-server` 依赖 `@moran/core` 获取 Drizzle schema 和共享类型，符合依赖方向：`mcp-server → core`（与 `server → core`、`web → core` 同向）。

### 3.3 入口与启动

```typescript
// packages/mcp-server/src/index.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMoranMcpServer } from "./server.js";

async function main() {
  const server = createMoranMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdio 模式下，进程随 transport 关闭而退出
}

main().catch((err) => {
  console.error("MCP Server fatal:", err);
  process.exit(1);
});
```

```typescript
// packages/mcp-server/src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/index.js";

export function createMoranMcpServer(): McpServer {
  const server = new McpServer({
    name: "moran-mcp",
    version: "1.0.0",
  });

  registerAllTools(server);
  return server;
}
```

### 3.4 数据库访问（决策 D3）

MCP Server 通过 Drizzle ORM 直接访问 PostgreSQL，复用 `@moran/core` 的 schema 定义：

```typescript
// packages/mcp-server/src/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@moran/core/db/schema";

// DATABASE_URL 由 OpenCode 容器环境变量注入
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

export const db = drizzle({
  connection: { connectionString },
  schema,
});
```

**为什么不通过 Hono API 访问 DB？**

1. MCP Server 运行在 OpenCode 容器内，与 Hono 不在同一进程/网络。
2. 经由 HTTP 绕一圈会增加延迟和错误点。
3. MCP 工具需要事务支持（如 `chapter_archive` 需要原子写入多表），HTTP API 无法提供。
4. 门禁检查需要高效的 DB 查询组合，直连最简单。

### 3.5 工具实现模式

所有 48 个工具遵循统一模式（完整工具接口定义见 `docs/v2-s6-mcp-gates.md` §3）：

```typescript
// packages/mcp-server/src/tools/character.ts
import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../db.js";
import { gateChecker } from "../gates/index.js";
import { ok, fail } from "../utils/response.js";
import { characters } from "@moran/core/db/schema";
import { eq } from "drizzle-orm";

export function registerCharacterTools(server: McpServer) {
  // ─── character_create ────────────────────────
  server.registerTool(
    "character_create",
    {
      description: "创建角色。门禁：创意简报 + 基础世界设定已存在。",
      inputSchema: z.object({
        projectId: z.string(),
        name: z.string(),
        role: z.enum(["protagonist", "deuteragonist", "antagonist", "supporting", "minor"]),
        designDepth: z.enum(["core", "important", "supporting", "decoration"]),
        profile: z.string(), // JSON：包含 personality, background, goals 等
      }),
    },
    async (input) => {
      // 1. 门禁检查
      const gate = await gateChecker.check(input.projectId, "character_design");
      if (!gate.passed) {
        return fail("GATE_FAILED", gate.reason, gate.details);
      }

      // 2. 执行 DB 操作
      const [created] = await db
        .insert(characters)
        .values({
          projectId: input.projectId,
          name: input.name,
          role: input.role,
          designDepth: input.designDepth,
          profile: input.profile,
        })
        .returning();

      // 3. 返回统一格式
      return ok({ characterId: created.id, name: created.name });
    }
  );

  // ─── character_read ──────────────────────────
  server.registerTool(
    "character_read",
    {
      description: "读取项目角色列表或单个角色详情。",
      inputSchema: z.object({
        projectId: z.string(),
        characterId: z.string().optional(),
      }),
    },
    async (input) => {
      // 读取工具无门禁
      if (input.characterId) {
        const char = await db.query.characters.findFirst({
          where: eq(characters.id, input.characterId),
        });
        return char ? ok(char) : fail("NOT_FOUND", "角色不存在");
      }

      const list = await db.query.characters.findMany({
        where: eq(characters.projectId, input.projectId),
      });
      return ok(list);
    }
  );

  // ... character_update, character_state_create, etc.
}
```

**统一响应格式**（详见 `docs/v2-s6-mcp-gates.md` §5、`specs/mcp-tools/SPEC.md` §4）：

```typescript
// packages/mcp-server/src/utils/response.ts

/** MCP 工具成功响应 */
export function ok(data: unknown) {
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ ok: true, data }),
    }],
  };
}

/** MCP 工具失败响应（门禁拒绝 / 业务错误） */
export function fail(code: string, message: string, details?: object) {
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ ok: false, error: { code, message, details } }),
    }],
  };
}
```

### 3.6 门禁系统实现

门禁逻辑集中在 `gates/` 目录，与工具代码解耦：

```typescript
// packages/mcp-server/src/gates/checker.ts
import { db } from "../db.js";
import { gateRules, type GateAction } from "./rules.js";

export interface GateResult {
  passed: boolean;
  reason: string;
  details: {
    passed: string[];   // 已满足的条件
    failed: string[];   // 未满足的条件
  };
}

export class GateChecker {
  /**
   * 检查指定动作的门禁条件
   * @param projectId - 项目 ID
   * @param action - 动作名（如 "character_design", "chapter_write"）
   * @param params - 额外参数（如 { chapterNumber: 1 }）
   */
  async check(
    projectId: string,
    action: GateAction,
    params?: Record<string, unknown>
  ): Promise<GateResult> {
    const rules = gateRules[action];
    if (!rules) {
      return { passed: true, reason: "", details: { passed: [], failed: [] } };
    }

    const passed: string[] = [];
    const failed: string[] = [];

    for (const rule of rules) {
      const result = await rule.check(db, projectId, params);
      if (result.ok) {
        passed.push(rule.description);
      } else if (rule.level === "HARD") {
        failed.push(`${rule.description}：${result.reason}`);
      }
      // SOFT/INFO 级别不阻断
    }

    return {
      passed: failed.length === 0,
      reason: failed.join("; "),
      details: { passed, failed },
    };
  }
}

export const gateChecker = new GateChecker();
```

```typescript
// packages/mcp-server/src/gates/rules.ts（示例）

export type GateAction =
  | "world_design"
  | "character_design"
  | "outline_design"
  | "chapter_write"
  | "review"
  | "archive";

interface GateRule {
  level: "HARD" | "SOFT" | "INFO";
  description: string;
  check: (
    db: DrizzleDB,
    projectId: string,
    params?: Record<string, unknown>
  ) => Promise<{ ok: boolean; reason?: string }>;
}

export const gateRules: Record<GateAction, GateRule[]> = {
  character_design: [
    {
      level: "HARD",
      description: "创意简报已存在",
      check: async (db, projectId) => {
        const brief = await db.query.projectDocuments.findFirst({
          where: and(
            eq(projectDocuments.projectId, projectId),
            eq(projectDocuments.type, "brief")
          ),
        });
        return brief
          ? { ok: true }
          : { ok: false, reason: "请先完成灵感脑暴并生成创意简报" };
      },
    },
    {
      level: "HARD",
      description: "基础世界设定已存在",
      check: async (db, projectId) => {
        const settings = await db.query.worldSettings.findMany({
          where: eq(worldSettings.projectId, projectId),
        });
        return settings.length > 0
          ? { ok: true }
          : { ok: false, reason: "请先创建基础世界设定" };
      },
    },
  ],

  chapter_write: [
    {
      level: "HARD",
      description: "大纲已存在",
      check: async (db, projectId) => { /* ... */ },
    },
    {
      level: "HARD",
      description: "至少有一个核心角色",
      check: async (db, projectId) => { /* ... */ },
    },
    {
      level: "SOFT",
      description: "前一章已归档",
      check: async (db, projectId, params) => { /* ... */ },
    },
  ],

  // ... 其他 action 的门禁规则
};
```

### 3.7 OpenCode 中的 MCP 声明（决策 D5）

在项目根目录的 `opencode.json` 中声明 MCP Server：

```jsonc
// opencode.json
{
  "mcp": {
    "moran-mcp": {
      "type": "local",
      "command": ["node", "/app/mcp-server/index.js"],
      "environment": {
        "DATABASE_URL": "{env:DATABASE_URL}"
      }
    }
  }
}
```

- `type: "local"` 表示 stdio 传输（OpenCode spawn 子进程）
- `command` 指向容器内路径（`/app/mcp-server/` 由 Docker volume 挂载）
- `{env:DATABASE_URL}` 从 OpenCode 容器环境变量注入，确保 MCP Server 能连接 PostgreSQL

> 所有 Agent 自动获得 `moran-mcp` 提供的工具。Agent 配置中通过 `tools` 字段控制各 Agent 可用哪些工具（参见 §4.3）。

---

## 4. OpenCode 集成技术方案

### 4.1 SDK 使用模式

Hono Server 通过 `@opencode-ai/sdk` 与 OpenCode serve 通信。SDK 是无状态 HTTP 客户端，每次调用创建新请求：

```typescript
import { createOpencodeClient } from "@opencode-ai/sdk";

// 现有 OpenCodeSessionManager 已封装此逻辑
const client = createOpencodeClient({
  baseUrl: process.env.OPENCODE_BASE_URL ?? "http://127.0.0.1:4096",
});
```

**核心 API 表面**（基于 SDK 实际调研）：

| API | 方法 | 用途 |
|-----|------|------|
| `session.create` | POST | 创建新的 Agent 会话 |
| `session.get` | GET | 获取 session 详情 |
| `session.list` | GET | 列出所有 session（用于重启恢复） |
| `session.delete` | DELETE | 删除 session |
| `session.chat` | POST | 发送消息并等待完成（同步） |
| `session.prompt` | POST | 发送消息，可选 `noReply` 静默注入（异步） |
| `session.messages` | GET | 获取 session 消息历史 |
| `session.abort` | POST | 中止正在进行的生成 |
| `event.list` | GET (SSE) | 订阅实时事件流 |
| `global.health` | GET | 健康检查 |

**两种消息发送模式**：

```typescript
// 模式 1：chat（同步等待完成）
// 适用于：前端用户发送消息，等待 Agent 完整响应
await client.session.chat(sessionId, {
  body: {
    parts: [{ type: "text", text: userMessage }],
  },
});

// 模式 2：prompt（异步，可选静默）
// 适用于：系统注入上下文、后台触发 Agent 工作
await client.session.prompt({
  path: { id: sessionId },
  body: {
    parts: [{ type: "text", text: systemContext }],
    noReply: true,  // 静默注入，Agent 不回复
  },
});
```

### 4.2 Session 生命周期

Session 由 `OpenCodeSessionManager`（`packages/server/src/opencode/manager.ts`）管理，维护 `(userId, projectId) → OpenCode sessionId` 的 1:1 映射。

#### 完整生命周期

```
用户打开项目
  │
  ▼
SessionManager.getOrCreateSession(userId, projectId)
  │
  ├─ 内存 Map 命中 → 返回已有 sessionId，更新 lastActiveAt
  │
  └─ 未命中 → client.session.create({ title: `moran-${userId}-${projectId}` })
       │
       ├─ 注册到 Map
       ├─ 执行 onNew 回调（注入项目上下文）
       └─ 返回 sessionId
  │
  ▼
用户对话中...
  │  • Hono 代理 chat/prompt 请求到 OpenCode
  │  • 订阅 event.list() SSE 流转发到前端
  │  • Agent 调用 MCP 工具写 DB
  │
  ▼
不活跃 30 分钟
  │
  ▼
SessionManager.sweep() 清理
  │  • 从 Map 移除（不删除 OpenCode session，保留历史）
  │
  ▼
用户再次打开
  │
  ▼
SessionManager.getOrCreateSession → 创建新映射（或恢复已有 session）
```

#### 持久化策略

| 层 | 持久化方式 | 重启行为 |
|----|----------|---------|
| Session 映射 | Hono 内存 Map | 丢失，通过 `session.list()` 重建 |
| 对话历史 | OpenCode SQLite | 自动恢复 |
| 业务数据 | PostgreSQL | 自动恢复 |

> Session 映射是可重建数据——Hono 重启后通过 `client.session.list()` + title 解析恢复映射，无需 Redis。

### 4.3 Agent 配置（决策 D4）

OpenCode 支持 Markdown frontmatter 格式的 Agent 配置文件。OpenCode 启动时自动扫描多个目录（`/.opencode/agents/`、`/agents/` 等），**墨染选择项目根目录的 `agents/`**——让 Agent 定义作为顶级产品资产，而非隐藏在 dotfile 配置中：

```
agents/                         # 项目根目录，与 packages/、specs/ 平级
├── moheng.md       # 墨衡（协调器）
├── lingxi.md       # 灵犀（脑暴）
├── jiangxin.md     # 匠心（设计）
├── zhibi.md        # 执笔（写作，含子写手切换逻辑）
├── mingjing.md     # 明镜（审校）
├── zaishi.md       # 载史（归档）
├── bowen.md        # 博闻（知识库）
├── xidian.md       # 析典（分析）
├── shuchong.md     # 书虫（读者反馈，可选）
└── dianjing.md     # 点睛（标题生成，可选）
```

> **为什么不用 `.opencode/agents/`？** Agent prompt 是墨染的核心产品逻辑（10 个 Agent 的行为定义），不是工具配置。放在顶级目录确保可见性、便于 code review 和版本追踪。`.opencode/` 仅保留 OpenCode 自身的运行时配置（`opencode.json`）。

**配置格式示例**：

```markdown
---
# agents/jiangxin.md
description: "匠心 — 世界观、角色、结构设计专家。负责创建和完善世界设定、角色体系、故事大纲。"
model: anthropic/claude-sonnet-4-20250514
temperature: 0.4
tools:
  # 允许使用的 MCP 工具（白名单，完整映射见 S6 §6）
  moran-mcp_world_create: true
  moran-mcp_world_read: true
  moran-mcp_world_update: true
  moran-mcp_world_delete: true
  moran-mcp_world_check: true
  moran-mcp_character_create: true
  moran-mcp_character_read: true
  moran-mcp_character_update: true
  moran-mcp_character_delete: true
  moran-mcp_relationship_create: true
  moran-mcp_relationship_read: true
  moran-mcp_relationship_update: true
  moran-mcp_outline_create: true
  moran-mcp_outline_read: true
  moran-mcp_outline_update: true
  moran-mcp_project_read: true
  moran-mcp_knowledge_read: true
  moran-mcp_gate_check: true
---

你是匠心，墨染创作团队的设计架构师。

## 你的职责

1. **世界观设计**：根据创意简报构建完整世界设定（基础设定 + 子系统 + 地点 + 术语表）
2. **角色设计**：创建角色体系，核心角色必须包含五维心理模型（GHOST → WOUND → LIE → WANT ↔ NEED）
3. **结构设计**：规划故事大纲（弧段 → 章节），确保结构完整性
4. **一致性**：设计完成后运行 world_consistency_check 检查矛盾

## 五维心理模型

核心层角色必须填写全部五维：
- GHOST（创伤根源）：过去发生的定义性创伤事件
- WOUND（心理伤痕）：此刻仍在运作的持续性心理痕迹
- LIE（核心谎言）：为生存形成的错误信念
- WANT（表面欲望）：角色以为自己需要什么
- NEED（真实需求）：角色真正需要什么才能成长

## 设计流程

1. 先调用 gate_check 确认当前阶段可以进行设计
2. 按顺序：世界设定 → 子系统 → 地点/术语 → 角色 → 关系 → 大纲
3. 每步完成后调用对应的 _read 工具验证写入成功
4. 最后运行 world_consistency_check

## 禁止事项

- 不要跳过门禁检查
- 不要创建没有心理模型的核心角色
- 不要直接与用户对话（通过墨衡转达）
```

**工具命名约定**：MCP 工具在 Agent 配置中的 key 格式为 `{mcp_server_name}_{tool_name}`，即 `moran-mcp_character_create`。

### 4.4 Agent 委派机制（SubtaskPart / Task）

墨衡通过 OpenCode 内置的 `task` 工具将工作委派给子 Agent：

```
墨衡（协调器）
  │
  ├── task → 灵犀（脑暴）
  ├── task → 匠心（设计）
  ├── task → 执笔（写作）
  ├── task → 明镜（审校）
  ├── task → 载史（归档）
  ├── task → 博闻（知识库）
  └── task → 析典（分析）
```

**委派模式**：

```
// 墨衡 system prompt 中的委派指令示例：
当用户说"开始脑暴"时：
1. 调用 gate_check({ projectId, action: "brainstorm" }) 确认可以开始
2. 使用 task 工具委派给灵犀：
   - agent: "lingxi"
   - prompt: "用户想法：{用户输入}。请执行发散→聚焦→结晶三步脑暴流程。"
3. 灵犀完成后，结果自动回流到墨衡
4. 墨衡将结果总结后回复用户
```

**关键约束**：
- 只有墨衡可以使用 `task` 工具——子 Agent 的 `tools` 配置中不包含 `task`
- 子 Agent 不直接与用户对话——它们的输出回流到墨衡，由墨衡整理后回复
- 子 Agent 通过 MCP 工具操作 DB——不通过对话内容传递结构化数据

### 4.5 执笔子写手切换

执笔（zhibi）是唯一需要动态切换模型的 Agent。9 个子写手对应不同的文风和推荐模型：

| 子写手 | 推荐模型 |
|--------|---------|
| 云墨 | Claude Sonnet |
| 剑心 | Kimi K2 |
| 星河 | GPT-4o |
| 素手 | Claude Opus |
| 烟火 | GPT-4o |
| 暗棋 | Claude Opus |
| 青史 | Claude Opus |
| 夜阑 | Gemma4 |
| 谐星 | GPT-4o |

**切换机制**：

墨衡在委派给执笔时，通过 `task` 工具的参数指定模型和文风指令：

```
// 墨衡委派执笔写作时：
task({
  agent: "zhibi",
  model: "anthropic/claude-opus-4-20250514",  // 素手风格 → Claude Opus
  prompt: "使用【执笔·素手】风格写作第 3 章。\n文风要求：温暖细腻、长句、情感细写、氛围渲染。\n[章节详案和写作上下文...]"
})
```

> 模型覆盖优先级：项目级覆盖 > 全局偏好 > 风格默认。项目级覆盖通过 `project_read` 获取项目配置中的模型偏好。

---

## 5. 数据访问层

### 5.1 写入路径（决策 D6）：唯一入口

**所有业务数据写入只通过 MCP 工具**，保证门禁不可绕过：

```
Agent 需要写入
  │
  ▼
调用 MCP 工具（如 character_create）
  │
  ▼
GateChecker.check() ── 门禁检查
  │
  ├─ 不通过 → 返回 { ok: false, reason } → Agent 收到拒绝
  │
  └─ 通过 → Drizzle INSERT/UPDATE → PostgreSQL
       │
       └─ 返回 { ok: true, data } → Agent 收到确认
```

**Hono Server 不暴露任何写入 API**。面板是只读的——用户的修改意图通过聊天传达给墨衡，由 Agent 通过 MCP 工具执行写入。

> 唯一例外：项目 CRUD 操作（创建/删除项目）可能由 Hono 直接处理，因为创建项目发生在 OpenCode session 建立之前。这属于"元操作"，不受创作门禁约束。

### 5.2 读取路径（决策 D7）：双通道

| 消费者 | 路径 | 用途 |
|--------|------|------|
| 前端面板 | 浏览器 → Hono Panel API → Drizzle → PG | 结构化数据展示（角色卡片、大纲树、章节列表） |
| Agent | Agent → MCP 读取工具 → Drizzle → PG | Agent 需要查询已有数据（如写作前读大纲） |

两条读取路径访问同一个 PostgreSQL 实例、同一套 Drizzle schema，但运行在不同进程中。

**为什么不让 Agent 通过 Hono API 读取？**
- MCP Server 运行在 OpenCode 容器内，访问 Host 网络上的 Hono 需要额外网络配置。
- Agent 读取通常伴随写入（读-判断-写），在同一进程内读写更高效。
- MCP 读取工具可以实现 Agent 专用的查询逻辑（如 `context_assemble` 组装写作上下文）。

### 5.3 连接池策略（决策 D8）

两个独立进程各自维护连接池：

```
┌─ Hono Server 进程 ─┐     ┌─ MCP Server 进程 ─┐
│  Drizzle Client     │     │  Drizzle Client    │
│  Pool: 5-10 conn    │     │  Pool: 3-5 conn    │
└────────┬────────────┘     └────────┬───────────┘
         │                           │
         └────────── TCP ────────────┘
                     │
              ┌──────▼──────┐
              │  PostgreSQL  │
              │  max_conn:   │
              │  100 (默认)   │
              └─────────────┘
```

| 池 | 进程 | 默认连接数 | 理由 |
|----|------|-----------|------|
| Hono Pool | Hono Server | 5–10 | Panel API 并发读取，需要较大池 |
| MCP Pool | MCP Server | 3–5 | Agent 串行调用工具，并发度低 |

**配置方式**：

```typescript
// Hono Server (packages/server/src/db.ts) — 已有
import { drizzle } from "drizzle-orm/node-postgres";
export const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL,
    max: 10,  // Hono 池
  },
  schema,
});

// MCP Server (packages/mcp-server/src/db.ts) — 新建
export const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL,
    max: 5,   // MCP 池
  },
  schema,
});
```

> 两个池共享同一 `DATABASE_URL`，指向同一 PostgreSQL 实例。PostgreSQL 默认 `max_connections = 100`，两个池总计 15 连接远低于上限。

### 5.4 事务边界

| 场景 | 事务范围 | 示例 |
|------|---------|------|
| 单工具操作 | Per-tool 原子 | `character_create` — 单条 INSERT |
| 多表关联写入 | Per-tool 事务 | `chapter_archive` — 同时写 summary + thread + timeline |
| 跨工具操作 | 无事务 | Agent 先调 `character_create` 再调 `relationship_create`，各自独立 |

```typescript
// 多表关联写入示例（chapter_archive）
async (input) => {
  const gate = await gateChecker.check(input.projectId, "archive", {
    chapterNumber: input.chapterNumber,
  });
  if (!gate.passed) return fail(gate.reason);

  // 使用事务确保原子性
  const result = await db.transaction(async (tx) => {
    // 1. 创建章节摘要
    const [summary] = await tx.insert(chapterSummaries).values({...}).returning();
    // 2. 更新伏笔线索
    await tx.insert(threadEvents).values({...});
    // 3. 创建时间线事件
    await tx.insert(timelineEvents).values({...});
    // 4. 更新章节状态为 archived
    await tx.update(chapters).set({ status: "archived" }).where(...);
    return summary;
  });

  return ok(result);
};
```

> 跨工具操作不保证事务性。如果 Agent 调用 `character_create` 成功但 `relationship_create` 失败，已创建的角色不会回滚。这是可接受的——Agent 可以重试失败的工具，门禁的幂等性保证重试安全。

---

## 6. 实时事件系统

### 6.1 端到端事件链路（决策 D9）

从 Agent 写入 DB 到前端面板刷新的完整链路：

```
Agent 调用 MCP 工具（如 character_create）
  │
  ▼
MCP Server 执行 DB 写入
  │
  ▼
返回结果给 Agent（via stdio）
  │
  ▼
OpenCode 发出 SSE 事件
  │  event type: "message.part.updated"
  │  payload: tool_call result（包含工具名和返回值）
  │
  ▼
Hono EventTransformer 捕获事件
  │  识别 tool_result 事件中的工具名
  │  映射到面板 Tab（如 character_create → 角色 Tab）
  │
  ▼
SSEBroadcaster 广播到前端
  │  event: { type: "tool_result", data: { tool: "character_create", tab: "character", ... } }
  │
  ▼
前端 SSE 客户端接收
  │  根据 tab 字段判断需要刷新哪个面板 Tab
  │
  ▼
Zustand store 触发对应 Tab 的数据 refetch
  │  GET /api/projects/:id/characters
  │
  ▼
面板 UI 更新
```

### 6.2 OpenCode SSE 事件消费

Hono Server 启动时订阅 OpenCode 的全局事件流：

```typescript
// packages/server/src/sse/opencode-listener.ts

export async function startOpenCodeEventListener(
  client: OpencodeClient,
  broadcaster: SSEBroadcaster,
  transformer: EventTransformer
) {
  const stream = await client.event.list();

  for await (const event of stream) {
    // 1. 转换事件格式
    const sseEvent = transformer.transform(event);
    if (!sseEvent) continue;  // 过滤无关事件

    // 2. 提取 sessionId，确定广播目标
    const sessionId = extractSessionId(event);
    if (!sessionId) continue;

    // 3. 广播给该 session 的所有前端连接
    broadcaster.broadcast(sessionId, sseEvent);
  }
}
```

### 6.3 工具-面板映射（Tool → Tab）

EventTransformer 维护工具名到面板 Tab 的映射表。仅映射**写入操作**（create / update / delete / archive / execute），读取操作不触发面板切换。

**Tab ID 常量**（8 个，对应面板 8 个 Tab）：

| Tab (中文) | Tab ID | 映射的域 |
|---|---|---|
| 脑暴 | `brainstorm` | brainstorm |
| 设定 | `settings` | world |
| 角色 | `characters` | character, character_state, relationship |
| 大纲 | `outline` | outline |
| 章节 | `chapters` | chapter, style, summary |
| 审校 | `review` | review |
| 分析 | `analysis` | analysis |
| 知识库 | `knowledge` | knowledge, lesson, thread, timeline |

**未映射的工具**：`project_read/update`（全局上下文）、`gate_check`（内部门禁）、`world_check`（一致性校验）、`context_assemble`（Agent 内部数据组装）、所有 `*_read` 操作。

```typescript
// packages/server/src/sse/transformer.ts

const TOOL_TAB_MAP: Record<string, string> = {
  // 脑暴 Tab
  brainstorm_create: "brainstorm",
  brainstorm_update: "brainstorm",

  // 设定 Tab（world 域统一，子类型由 type 参数区分）
  world_create: "settings",
  world_update: "settings",
  world_delete: "settings",

  // 角色 Tab
  character_create: "characters",
  character_update: "characters",
  character_delete: "characters",
  character_state_create: "characters",
  relationship_create: "characters",
  relationship_update: "characters",

  // 大纲 Tab（子类型由 type 参数区分）
  outline_create: "outline",
  outline_update: "outline",

  // 章节 Tab
  chapter_create: "chapters",
  chapter_update: "chapters",
  chapter_archive: "chapters",
  style_create: "chapters",
  style_update: "chapters",
  summary_create: "chapters",

  // 审校 Tab（单工具，轮次由 round 参数区分）
  review_execute: "review",

  // 分析 Tab
  analysis_execute: "analysis",

  // 知识库 Tab
  knowledge_create: "knowledge",
  knowledge_update: "knowledge",
  knowledge_delete: "knowledge",
  lesson_create: "knowledge",
  lesson_update: "knowledge",
  thread_create: "knowledge",
  thread_update: "knowledge",
  timeline_create: "knowledge",
};
```

### 6.4 面板自动切换与保护期

当 SSE 事件触发 Tab 切换时，需要尊重用户的操作上下文：

```typescript
// packages/web/src/stores/panel-store.ts（概念设计）

interface PanelState {
  activeTab: string;
  lastUserInteraction: number;  // 用户最后一次手动切换 Tab 的时间戳
}

const PROTECTION_PERIOD_MS = 10_000;  // 10 秒保护期

function shouldAutoSwitch(currentTime: number, state: PanelState): boolean {
  return currentTime - state.lastUserInteraction > PROTECTION_PERIOD_MS;
}
```

**规则**：
- 用户手动切换 Tab 后，10 秒内不自动切换（保护期）
- 保护期过后，SSE 事件触发的 Tab 切换自动生效
- 前端收到 SSE 事件后，无论是否切换 Tab，都执行对应 Tab 的数据 refetch

---

## 7. 认证与安全

### 7.1 MVP 认证模型（决策 D10）

V2 MVP 采用最简认证方案：

```
浏览器 → Next.js 中间件 → Hono API
                │
                └── x-user-id: "user-123"（由 Next.js 注入）
```

| 层 | 认证方式 | 说明 |
|----|---------|------|
| 浏览器 → Next.js | Session cookie | Next.js Auth 中间件校验 |
| Next.js → Hono | `x-user-id` header | Next.js rewrite 时注入 |
| Hono → OpenCode | `OPENCODE_SERVER_PASSWORD` | HTTP Basic Auth（SDK 内置） |
| OpenCode → MCP | 无需认证 | stdio 本地通信，同容器内 |
| MCP → PostgreSQL | `DATABASE_URL` | 连接串内含用户名密码 |

**MVP 局限性**（已知，V2 后续版本解决）：

- `x-user-id` 可伪造——MVP 阶段无真实身份验证
- 无 RBAC（所有用户权限相同）
- 无 API rate limiting
- 无 CSRF 保护（同源 rewrite 降低风险但不消除）

### 7.2 OpenCode 认证

OpenCode serve 支持通过 `OPENCODE_SERVER_PASSWORD` 环境变量启用 HTTP Basic Auth：

```yaml
# docker-compose.dev.yml（如启用）
opencode:
  environment:
    - OPENCODE_SERVER_PASSWORD=dev-password-123
```

SDK 自动处理认证头：

```typescript
const client = createOpencodeClient({
  baseUrl: "http://localhost:4096",
  // SDK 自动读取环境变量或接受显式传入
});
```

> 开发环境可不设密码（OpenCode serve 默认无需认证）。生产环境必须设置。

### 7.3 MCP 内的用户身份（决策 D11）

MCP Server 不接收 `userId` 参数。用户身份通过 `projectId` 隐式绑定：

```
用户 A → Session A → 墨衡 A → MCP 工具（projectId: "proj-123"）
用户 B → Session B → 墨衡 B → MCP 工具（projectId: "proj-456"）
```

**安全模型**：
- 每个 OpenCode session 绑定一个 `(userId, projectId)` 对
- 墨衡 system prompt 中注入当前 `projectId`
- MCP 工具只接受 `projectId`，所有查询/写入都带 `WHERE project_id = ?`
- Agent 无法跨项目操作（projectId 由 session 上下文固定）

**已知风险**：Agent 理论上可以构造任意 `projectId` 调用 MCP 工具。MVP 阶段接受此风险——后续可在 MCP 工具层添加 session-projectId 绑定校验。

---

## 8. 错误处理与恢复

### 8.1 故障分类

| 故障层 | 故障类型 | 影响 | 恢复策略 |
|--------|---------|------|---------|
| LLM Provider | API 超时/限流/错误 | Agent 生成中断 | OpenCode 内置重试 + 前端显示错误 |
| OpenCode serve | 进程崩溃 | 所有 session 中断 | Docker `restart: unless-stopped`，Hono 检测到健康检查失败后通知前端 |
| MCP Server | 进程崩溃 | 工具调用失败 | OpenCode 自动重启 stdio 子进程 |
| PostgreSQL | 连接断开 | 数据读写失败 | Drizzle 连接池自动重连，工具返回错误让 Agent 重试 |
| Hono Server | 进程崩溃 | API 不可用 | PM2/systemd 自动重启，前端显示连接断开 |
| 网络 | Hono ↔ OpenCode 断开 | SSE 中断 | EventSource 自动重连 + EventBuffer 回放 |

### 8.2 MCP 工具错误处理

```typescript
// 工具内部错误处理模式
async (input) => {
  try {
    // 1. 门禁检查
    const gate = await gateChecker.check(input.projectId, action);
    if (!gate.passed) {
      return fail(gate.reason);  // 业务拒绝，非异常
    }

    // 2. DB 操作
    const result = await db.insert(table).values(data).returning();
    return ok(result[0]);

  } catch (err) {
    // 3. 异常处理
    if (err instanceof DrizzleError) {
      // DB 错误：返回可理解的错误信息
      return fail(`数据库操作失败：${err.message}`);
    }
    // 未知错误：向上抛出，由 MCP Server 框架处理
    throw err;
  }
};
```

**错误传播链**：

```
MCP 工具抛出异常
  │
  ▼
MCP SDK 框架捕获 → JSON-RPC error 返回给 OpenCode
  │
  ▼
OpenCode 将错误作为 tool_result 传给 Agent
  │
  ▼
Agent 决定：重试 / 报告给用户 / 尝试替代方案
  │
  ▼
墨衡将错误信息转述给用户（如果需要）
```

### 8.3 审校螺旋检测

明镜四轮审校可能陷入"修改→审校→修改→审校"的无限循环：

```typescript
// 螺旋检测逻辑（在 review_round* 工具中）
const MAX_REVIEW_CYCLES = 3;  // 同一章节同一轮次最多审校 3 次

async function checkReviewSpiral(
  projectId: string,
  chapterNumber: number,
  round: number
): Promise<{ ok: boolean; count: number }> {
  const count = await db.query.reviewRecords.findMany({
    where: and(
      eq(reviewRecords.projectId, projectId),
      eq(reviewRecords.chapterNumber, chapterNumber),
      eq(reviewRecords.round, round),
    ),
  });

  return {
    ok: count.length < MAX_REVIEW_CYCLES,
    count: count.length,
  };
}
```

超过阈值时，工具返回警告而非拒绝，让墨衡决定是否强制通过。

### 8.4 SSE 断线恢复

前端 SSE 连接断开时的恢复机制：

```
前端 EventSource 断开
  │
  ▼
自动重连（浏览器内置，指数退避）
  │
  ▼
携带 Last-Event-ID header
  │
  ▼
Hono SSE 端点从 EventBuffer 中找到该 ID 之后的事件
  │
  ▼
回放缺失的事件 → 前端状态追上
```

EventBuffer 保留最近 1000 条事件（per-session），超出后丢弃最旧的。如果断线时间过长导致 buffer 已清空，前端降级为全量 refetch。

---

## 9. 对已有 Spec 的影响

本技术方案确立后，以下 SDD Spec 需要对齐更新：

| Spec | 需更新内容 | 优先级 |
|------|-----------|--------|
| `specs/opencode-integration/` | MCP 传输明确为 stdio；Agent 配置格式从 YAML 改为 Markdown frontmatter；SDK API 对齐实际调研结果 | 高 |
| `specs/infrastructure/` | docker-compose.dev.yml 增加 MCP 相关 volume 和环境变量；新增 `packages/mcp-server/` 包初始化步骤 | 高 |
| `specs/sse-realtime/` | EventTransformer 增加 Tool→Tab 映射表；OpenCode SSE 事件消费模式对齐 SDK 实际 API | 中 |
| `specs/agents/` | Agent 配置格式对齐 Markdown frontmatter；工具权限白名单格式 `{mcp}_{tool}: true`；task 委派机制替代模糊的 SubtaskPart 描述 | 高 |
| `specs/api-routes/` | 明确 Panel API 只读（项目 CRUD 除外）；移除任何写入端点的假设 | 中 |
| `specs/database/` | 确认 MCP Server 独立连接池；补充 `packages/mcp-server/src/db.ts` 的 schema 导入方式 | 低 |
| `specs/chat-ui/` | 对齐 SSE 事件类型与实际 OpenCode 事件 | 低 |
| `specs/info-panel/` | 确认 Tool→Tab 映射表覆盖所有面板 Tab；保护期逻辑从概念设计变为具体实现方案 | 中 |

### 更新原则

1. **Spec 引用本文档**：各 Spec 的 DESIGN.md 可引用 `v2-s11-technical-architecture.md §X.X` 避免重复
2. **不重复定义**：技术决策只在本文档定义一次，Spec 中引用而非复制
3. **向下兼容**：已有 Spec 的验收标准（SPEC.md）通常不需要修改，只需更新 DESIGN.md 的技术实现细节
