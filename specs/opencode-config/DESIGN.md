# opencode-config — DESIGN

> **状态**：v2（根据用户反馈修订）
> **模块**：opencode-config
> **关联**：`AGENTS.md` §5、§8

## 1. 问题定义

当前 OpenCode 配置存在两个结构性缺陷：

| 问题 | 现状 | 后果 |
|------|------|------|
| Agent 定义缺失 | `opencode.json` 只有 MCP，无 provider 配置 | Docker 容器内 OpenCode 无法调用 LLM |
| Provider 配置离散 | 依赖开发者个人配置或 GitHub Copilot OAuth | 换机器/新成员无法复现 |

**根因**：配置被当作"开发者个人环境"而非"项目基础设施"。

**设计决策（已确认）**：

1. **砍掉执笔 Agent** — 墨衡直接路由到子写手，减少一跳
2. **不用 auth.json** — 全部用 `.env` 里的 API Key 直连 Provider
3. **直连模型 ID** — `anthropic/claude-sonnet-4-20250514` 而非 `github-copilot/claude-sonnet-4`

## 2. 设计目标

1. **项目自包含**：`git clone` + 填 API Key → 可运行
2. **密钥分离**：配置文件可提交，密钥通过 `.env` 注入
3. **环境一致**：所有环境使用同一份 `opencode.json`
4. **易于维护**：新增 Agent / 修改模型，只改一处

## 3. 配置架构

```
┌─────────────────────────────────────────────────────────┐
│ opencode.json （项目根目录，提交到 git）                    │
│  ├── provider    — 自定义模型服务端点（无密钥）             │
│  └── mcpServers  — MCP 工具进程配置                       │
├─────────────────────────────────────────────────────────┤
│ agents/*.md （项目根目录，提交到 git）                      │
│  ├── 9 个核心 Agent prompt（frontmatter 含 model/temp）   │
│  └── writers/*.md — 9 个子写手 prompt（构建产物）           │
├─────────────────────────────────────────────────────────┤
│ .env （gitignored，开发者本地填写）                        │
│  ├── ANTHROPIC_API_KEY    — 必填（核心 Agent + 部分子写手）│
│  ├── OPENAI_API_KEY       — 可选（星河/烟火/谐星子写手）   │
│  ├── MOONSHOT_API_KEY     — 可选（剑心子写手）             │
│  └── DATABASE_URL         — 数据库连接串                   │
├─────────────────────────────────────────────────────────┤
│ .env.example （提交到 git，模板 + 注释说明）               │
└─────────────────────────────────────────────────────────┘
```

**数据流**：

```
开发者本地：
  opencode.json (git) + agents/ (git) + .env (local)
      │
      ▼
  docker-compose.dev.yml
      │  挂载 opencode.json → /app/opencode.json
      │  挂载 agents/       → /app/agents
      │  传入 .env          → 容器环境变量（API Keys）
      ▼
  OpenCode 容器 (:4096)
      │  读取 opencode.json → Provider + MCP 配置
      │  读取 agents/*.md   → Agent 定义（auto-discovery）
      │  读取 env vars      → API Keys
      ▼
  Hono API Server (:3200)
      └── OpenCode SDK → 创建 session → 调度 Agent
```

## 4. 文件布局

```
moran-ai/
├── opencode.json           ← provider + MCP 配置（提交）
├── .env                    ← API Keys（gitignored）
├── .env.example            ← 模板（提交）
├── docker-compose.dev.yml  ← 开发环境编排
└── agents/
    ├── moheng.md           ← 墨衡（协调器）
    ├── lingxi.md           ← 灵犀（脑暴）
    ├── jiangxin.md         ← 匠心（设计）
    ├── mingjing.md         ← 明镜（审校）
    ├── zaishi.md           ← 载史（归档）
    ├── bowen.md            ← 博闻（知识库）
    ├── xidian.md           ← 析典（分析）
    ├── shuchong.md         ← 书虫（读者反馈）
    ├── dianjing.md         ← 点睛（标题/简介）
    └── writers/
        ├── _base.md        ← 共享写作方法论（模板源，非 Agent）
        ├── yunmo.style.md  ← 云墨文风片段（源文件）
        ├── jianxin.style.md
        ├── xinghe.style.md
        ├── sushou.style.md
        ├── yanhuo.style.md
        ├── anqi.style.md
        ├── qingshi.style.md
        ├── yelan.style.md
        ├── jiexing.style.md
        ├── yunmo.md        ← 构建产物 = frontmatter + style body + _base
        ├── jianxin.md
        └── ...             ← （9 个构建产物）
```

> `_base.md` 和 `*.style.md` 是源文件（提交到 git），`*.md`（不含 _base）是构建产物（也提交，方便 OpenCode 直接读取）。

## 5. Agent 体系（18 个）

### 5.1 砍掉执笔的理由

原始设计：`用户 → 墨衡 → 执笔（选子写手） → 子写手`

修订设计：`用户 → 墨衡 → 子写手`

理由：

1. 墨衡已有 `context_assemble` 工具，能直接组装写作上下文
2. OpenCode 的模型绑定在 Agent 级别，子写手必须注册为独立 Agent
3. 执笔作为中间调度器只增加一跳延迟，无实际价值
4. zhibi.md 的写作方法论变为共享模板 `_base.md`，由构建脚本注入各子写手

### 5.2 Agent 注册清单

**核心 Agent（9 个）** — 通过 `agents/*.md` frontmatter 自动发现：

| Agent | 文件 | 模型 | 温度 |
|-------|------|------|------|
| 墨衡 moheng | agents/moheng.md | anthropic/claude-sonnet-4-20250514 | 0.3 |
| 灵犀 lingxi | agents/lingxi.md | anthropic/claude-sonnet-4-20250514 | 0.9 |
| 匠心 jiangxin | agents/jiangxin.md | anthropic/claude-sonnet-4-20250514 | 0.5 |
| 明镜 mingjing | agents/mingjing.md | anthropic/claude-sonnet-4-20250514 | 0.3 |
| 载史 zaishi | agents/zaishi.md | anthropic/claude-sonnet-4-20250514 | 0.2 |
| 博闻 bowen | agents/bowen.md | anthropic/claude-sonnet-4-20250514 | 0.3 |
| 析典 xidian | agents/xidian.md | anthropic/claude-sonnet-4-20250514 | 0.3 |
| 书虫 shuchong | agents/shuchong.md | anthropic/claude-sonnet-4-20250514 | 0.8 |
| 点睛 dianjing | agents/dianjing.md | anthropic/claude-sonnet-4-20250514 | 0.7 |

**子写手（9 个）** — 通过 `agents/writers/*.md` frontmatter 定义：

| 子写手 | 文件 | 模型 | 温度 | 所需 API Key |
|--------|------|------|------|-------------|
| 执笔·云墨 | writers/yunmo.md | anthropic/claude-sonnet-4-20250514 | 0.7 | ANTHROPIC_API_KEY |
| 执笔·剑心 | writers/jianxin.md | moonshotai/kimi-k2-0905-preview | 0.7 | MOONSHOT_API_KEY |
| 执笔·星河 | writers/xinghe.md | openai/gpt-4o | 0.7 | OPENAI_API_KEY |
| 执笔·素手 | writers/sushou.md | anthropic/claude-opus-4-20250514 | 0.8 | ANTHROPIC_API_KEY |
| 执笔·烟火 | writers/yanhuo.md | openai/gpt-4o | 0.8 | OPENAI_API_KEY |
| 执笔·暗棋 | writers/anqi.md | anthropic/claude-opus-4-20250514 | 0.6 | ANTHROPIC_API_KEY |
| 执笔·青史 | writers/qingshi.md | anthropic/claude-opus-4-20250514 | 0.6 | ANTHROPIC_API_KEY |
| 执笔·夜阑 | writers/yelan.md | llamacpp/gemma-4-27b | 0.7 | 无 |
| 执笔·谐星 | writers/jiexing.md | openai/gpt-4o | 0.9 | OPENAI_API_KEY |

> 夜阑使用本地 Gemma4 模型。若本地模型不可用，在 frontmatter 中配置 `fallback_model: anthropic/claude-opus-4-20250514`。

### 5.3 墨衡路由变更

moheng.md 意图路由表中，写作相关条目变更：

| 旧路由 | 新路由 |
|--------|--------|
| 写作/续写/生成章节/写下一章 → 执笔 (zhibi) | → 子写手（由墨衡根据项目文风配置选择） |
| 修改章节/修订/润色 → 执笔 (zhibi) | → 子写手（由墨衡选择当前章节对应的子写手） |

墨衡新增职责：

1. 读取项目文风配置（`style_read`）
2. 根据文风选择对应子写手 Agent
3. 通过 `context_assemble` 组装完整写作上下文
4. 通过 `SubtaskPart` 委派给选定的子写手

## 6. Provider 配置

### 6.1 Provider 清单

| Provider | 用途 | 认证方式 | 配置需求 |
|----------|------|---------|---------|
| `anthropic` | Claude Sonnet/Opus（核心 Agent + 部分子写手） | ANTHROPIC_API_KEY | 内置，无需显式配置 |
| `openai` | GPT-4o（星河/烟火/谐星子写手） | OPENAI_API_KEY | 内置，无需显式配置 |
| `moonshotai` | Kimi K2（剑心子写手） | MOONSHOT_API_KEY | 需配 endpoint URL |
| `llamacpp` | 本地 Gemma4（夜阑子写手） | 无 | 需配 baseURL |

### 6.2 opencode.json provider 配置

```jsonc
{
  "provider": {
    "moonshotai": {
      "api": "https://api.moonshot.cn/v1",
      "options": {
        "baseURL": "https://api.moonshot.cn/v1"
      }
    },
    "llamacpp": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LM Studio (local)",
      "options": {
        "baseURL": "http://host.docker.internal:1234/v1"
      },
      "models": {
        "gemma-4-27b": {
          "context": 120000,
          "output": 8192,
          "tool_call": true,
          "reasoning": true
        }
      }
    }
  }
}
```

`anthropic` 和 `openai` 是 OpenCode 内置 provider，无需显式配置。API Key 通过环境变量自动读取。

### 6.3 API Key 环境变量映射

| Provider | 环境变量 | 必要性 |
|----------|---------|--------|
| anthropic | `ANTHROPIC_API_KEY` | **必填**（核心 Agent 全部依赖） |
| openai | `OPENAI_API_KEY` | 可选（仅 3 个子写手需要） |
| moonshotai | `MOONSHOT_API_KEY` | 可选（仅剑心需要） |
| llamacpp | 无 | 本地服务，无认证 |

## 7. Docker 集成

### 7.1 docker-compose.dev.yml 变更

```yaml
services:
  opencode:
    image: ghcr.io/anomalyco/opencode:latest
    command: ["serve", "--hostname", "0.0.0.0", "--port", "4096"]
    ports:
      - "4096:4096"
    volumes:
      - ./opencode.json:/app/opencode.json:ro
      - ./agents:/app/agents:ro
      - ./packages/mcp-server:/app/packages/mcp-server:ro
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
      - MOONSHOT_API_KEY=${MOONSHOT_API_KEY:-}
      - DATABASE_URL=${DATABASE_URL}
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://127.0.0.1:4096/global/health || exit 1"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s
```

### 7.2 关键变更

| 项 | 旧 | 新 |
|----|----|----|
| auth.json 挂载 | `${USERPROFILE}/.local/share/opencode/auth.json` | **删除** |
| API Key 传入 | 无 | ANTHROPIC / OPENAI / MOONSHOT_API_KEY 从 .env 注入 |
| 模型 ID | `github-copilot/*` | `anthropic/*`、`openai/*`、`moonshotai/*` |

## 8. opencode.json 完整结构

```jsonc
{
  "provider": {
    "moonshotai": {
      "api": "https://api.moonshot.cn/v1",
      "options": {
        "baseURL": "https://api.moonshot.cn/v1"
      }
    },
    "llamacpp": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LM Studio (local)",
      "options": {
        "baseURL": "http://host.docker.internal:1234/v1"
      },
      "models": {
        "gemma-4-27b": {
          "context": 120000,
          "output": 8192,
          "tool_call": true,
          "reasoning": true
        }
      }
    }
  },

  "mcpServers": {
    "moran-mcp": {
      "command": "node",
      "args": ["./packages/mcp-server/dist/index.js"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      }
    }
  }
}
```

> **Agent 定义不在此文件中**：核心 Agent（9 个）通过 `agents/*.md` frontmatter 自动发现。子写手（9 个）通过 `agents/writers/*.md` frontmatter 定义。如果 OpenCode 不扫描子目录，需要在此补充 agent 注册条目（见 §12 待验证）。

## 9. .env.example 模板

```bash
# ============================
# 墨染 (MoRan) 环境变量
# ============================
# 复制此文件为 .env 并填入实际值：cp .env.example .env

# ---- PostgreSQL ----
POSTGRES_PASSWORD=moran_dev_password
DATABASE_URL=postgresql://moran:moran_dev_password@localhost:5432/moran

# ---- Server ----
PORT=3200
SERVER_PORT=3200
NODE_ENV=development

# ---- OpenCode ----
OPENCODE_BASE_URL=http://127.0.0.1:4096

# ---- LLM API Keys ----
# Anthropic（必填 — 核心 Agent + 部分子写手均使用 Claude）
# 获取：https://console.anthropic.com/
ANTHROPIC_API_KEY=

# OpenAI（可选 — 星河/烟火/谐星子写手使用 GPT-4o）
# 获取：https://platform.openai.com/
OPENAI_API_KEY=

# Moonshot（可选 — 剑心子写手使用 Kimi K2）
# 获取：https://platform.moonshot.cn/
MOONSHOT_API_KEY=

# ---- WebUI ----
WEB_PORT=3000
API_UPSTREAM=http://localhost:3200
```

## 10. 开发者引导流程

```bash
# 1. Clone
git clone <repo> && cd moran-ai

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，至少填入 ANTHROPIC_API_KEY

# 4. 构建子写手 Prompt（如有修改 _base.md 或 *.style.md）
pnpm run build:prompts

# 5. 启动服务
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL + OpenCode
pnpm run dev                                      # Hono + Next.js

# 6. 验证
curl http://localhost:4096/global/health     # OpenCode
curl http://localhost:3200/api/health        # API Server
open http://localhost:3000                   # Web UI
```

## 11. 子写手 Prompt 构建

### 11.1 设计

**问题**：9 个子写手共享写作方法论（~120 行），但各有独特文风指令。

**方案**：模板源 + 文风片段 + 构建脚本

```
agents/writers/_base.md        ← 共享写作方法论（来自原 zhibi.md）
agents/writers/{name}.style.md ← frontmatter + 身份定位 + 文风指令
→ 构建产物：agents/writers/{name}.md = style frontmatter + style body + _base
```

### 11.2 构建脚本

`scripts/build-writer-prompts.ts`：

1. 读取 `_base.md`
2. 遍历 `*.style.md`
3. 提取 style 的 frontmatter 和 body
4. 拼接：`frontmatter` + `---\n\n` + `style body` + `\n\n` + `_base content`
5. 写入 `{name}.md`

注册到 package.json：

```json
"scripts": {
  "build:prompts": "tsx scripts/build-writer-prompts.ts"
}
```

### 11.3 _base.md 来源

`_base.md` 内容来自现有 `agents/zhibi.md`，保留：

- 核心工作流（初始写作 + 修订）
- 文风系统说明
- 题材技法说明
- 温度场景化
- 写作教训系统
- 质量标准
- 行为准则

去掉：

- frontmatter（各子写手有自己的）
- 身份定位段落（各子写手有自己的）

### 11.4 .style.md 结构

每个 `{name}.style.md` 包含：

```markdown
---
description: "执笔·{子名} — {文风特征}"
model: {对应模型 ID}
temperature: {温度值}
tools:
  moran-mcp_project_read: true
  moran-mcp_context_assemble: true
  moran-mcp_chapter_create: true
  moran-mcp_chapter_update: true
  moran-mcp_chapter_patch: true
  moran-mcp_style_read: true
  moran-mcp_lesson_read: true
---

你是执笔·{子名}——墨染创作系统的{风格}写手。

## 身份定位
{1-2 句身份描述}

## 文风特征
{核心特征、句式风格、节奏说明}

## 禁忌
{不可做的事情}

## 示例段落
{一段展示该风格的中文示例}
```

## 12. 待验证事项

| 事项 | 验证方式 |
|------|---------|
| OpenCode 是否扫描 `agents/` 子目录 | 创建 `agents/writers/yunmo.md` → 检查 agent 是否可调度 |
| `fallback_model` 在 provider 不可达时是否自动切换 | Docker 内不启动 LM Studio，观察夜阑是否 fallback |
| `moonshotai` provider API Key 环境变量名是否为 `MOONSHOT_API_KEY` | 查 OpenCode 文档或测试 |
| `host.docker.internal` 在 Linux Docker 上是否可用 | Linux 需要 `extra_hosts: ["host.docker.internal:host-gateway"]` |

## 13. AGENTS.md 同步更新

1. **§5 标题**：Agent 体系（10 个）→ Agent 体系（18 个：9 核心 + 9 子写手）
2. **§5 核心 Agent 表**：删除执笔行（5 核心 → 4 核心），支援 Agent 不变
3. **§5 新增章节**：子写手注册说明（文件路径、构建方式）
4. **§8 OpenCode 集成**：补充 Provider 配置和 API Key 说明
5. **§12 里程碑**：新增 OpenCode 配置管理完成状态

## 14. 实施步骤

1. 创建 `agents/writers/` 目录 + `_base.md` + 9 个 `.style.md`
2. 创建 `scripts/build-writer-prompts.ts` + 注册 `build:prompts` 脚本
3. 运行 `build:prompts` 生成 9 个子写手 `.md`
4. 更新 `opencode.json`（provider + MCP）
5. 创建 `.env.example`
6. 更新 `.env`（补充 ANTHROPIC_API_KEY 等占位）
7. 更新 `docker-compose.dev.yml`（去掉 auth mount，加 env 传入）
8. 更新 `agents/moheng.md`（路由表变更）
9. 删除 `agents/zhibi.md`（内容已迁移到 `_base.md`）
10. 更新 `AGENTS.md`
11. 验证：重建 Docker 容器 → 健康检查 → 尝试创建 session
