# opencode-integration — DESIGN

> **状态**：已完成
> **模块**：opencode-integration

## 1. 当前状态

| 组件 | 状态 | V2 改动 |
|------|------|---------|
| `OpenCodeSessionManager` | ✅ 可用 | 增强：持久化 session 映射到 DB |
| MCP Server | ❌ 不存在 | 全新构建：47 个工具 + 门禁 |
| Agent 配置 | ❌ 不存在 | 全新构建：10 Agent YAML 配置 |
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
│   │   ├── brainstorm.ts     ← brainstorm_create/read/update
│   │   ├── world.ts          ← world_setting_* (10 工具)
│   │   ├── character.ts      ← character_* (7 工具)
│   │   ├── writing.ts        ← style_*, outline_*, chapter_* (10 工具)
│   │   ├── review.ts         ← review_round1/2/3/4 (4 工具)
│   │   ├── archive.ts        ← summary_*, thread_*, timeline_* (4 工具)
│   │   ├── knowledge.ts      ← knowledge_*, lesson_* (4 工具)
│   │   └── analysis.ts       ← analysis_run/read (2 工具)
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

每个工具文件导出注册函数，统一模式：

```typescript
// src/tools/project.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb } from "@moran/core/db";
import { projects } from "@moran/core/db/schema";
import { GateChecker } from "../gates/checker.js";
import type { MCPToolResult } from "../types.js";

export function registerProjectTools(server: McpServer) {
  server.tool(
    "project_read",
    "获取项目详情和当前阶段",
    { projectId: z.string().uuid() },
    async ({ projectId }): Promise<MCPToolResult> => {
      const db = getDb();
      const project = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!project.length) return { ok: false, error: { code: "NOT_FOUND", message: "Project not found" } };
      return { ok: true, data: project[0] };
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
      const checker = new GateChecker(getDb());
      return checker.check(projectId, action, params);
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

// 规则映射表
const GATE_RULES: Record<string, GateRule[]> = {
  "world_setting_create": [
    { name: "创意简报已存在", level: "HARD", evaluate: hasBrainstormBrief },
  ],
  "character_create": [
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

Agent 配置存放在项目根目录 `opencode-config/` 下，通过 Docker volume 映射给 OpenCode：

```
opencode-config/
├── agents/
│   ├── moheng.yaml       ← 墨衡（协调器）
│   ├── lingxi.yaml       ← 灵犀（脑暴）
│   ├── jiangxin.yaml     ← 匠心（设计）
│   ├── zhibi.yaml        ← 执笔（写作 + 9 子写手引用）
│   ├── mingjing.yaml     ← 明镜（审校）
│   ├── zaishi.yaml       ← 载史（归档）
│   ├── bowen.yaml        ← 博闻（知识库）
│   ├── xidian.yaml       ← 析典（分析）
│   ├── shuchong.yaml     ← 书虫（读者）
│   └── dianjing.yaml     ← 点睛（标题）
├── styles/
│   ├── yunmo.yaml         ← 云墨（默认风格）
│   ├── jianxin.yaml      ← 剑心（仙侠）
│   ├── xinghe.yaml       ← 星河（科幻）
│   ├── sushou.yaml       ← 素手（情感）
│   ├── yanhuo.yaml       ← 烟火（都市）
│   ├── anqi.yaml         ← 暗棋（悬疑）
│   ├── qingshi.yaml      ← 青史（历史）
│   ├── yelan.yaml        ← 夜阑（惊悚）
│   └── jiexing.yaml      ← 谐星（喜剧）
└── mcp.json              ← MCP Server 连接配置
```

#### 2.4.2 Agent YAML 格式

```yaml
# agents/moheng.yaml
name: 墨衡
id: moheng
model: claude-sonnet-4-20250514
temperature: 0.3
system_prompt: |
  你是墨衡——墨染创作系统的协调器...
  [详细 system prompt]
tools:
  - "*"  # 墨衡有全部工具权限
  - dispatch  # 委派能力
```

```yaml
# agents/lingxi.yaml
name: 灵犀
id: lingxi
model: claude-sonnet-4-20250514
temperature: 0.9
system_prompt: |
  你是灵犀——墨染创作系统的灵感碰撞专家...
tools:
  - brainstorm_create
  - brainstorm_read
  - brainstorm_update
```

#### 2.4.3 Docker Volume 挂载

```yaml
# docker-compose.dev.yml 新增
opencode:
  volumes:
    - ./opencode-config:/app/config:ro
```

### 2.5 新增包和依赖

| 包/模块 | 类型 | 依赖 |
|---------|------|------|
| `packages/mcp-server` | 新包 | `@modelcontextprotocol/sdk`, `@moran/core`, `zod` |
| `opencode-config/` | 配置目录 | 无代码依赖 |

## 3. 不需要改动的部分

- `OpenCodeSessionManager` 的核心逻辑（getOrCreateSession / checkHealth / cleanup）
- Docker Compose 的 PostgreSQL 配置
- Next.js rewrite 代理

## 4. 风险与注意事项

- **MCP Server 是最大模块**：47 个工具 + 门禁逻辑，占 V2 工作量 ~35%
- **OpenCode SDK API 可能变化**：需要查阅最新文档确认 session.prompt / session.messages 等 API
- **Agent system prompt 质量**：直接影响 Agent 行为，需要反复调试
- **门禁全部基于 DB 查询**：如果查询复杂度高，可能影响 MCP 工具响应速度
- **MCP SDK 版本**：确认使用 `@modelcontextprotocol/sdk` 最新稳定版
