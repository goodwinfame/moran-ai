# AGENTS.md — 墨染 V2 项目总宪

> **角色**：本文件是项目的 Single Source of Truth，供所有 AI Agent 读取。
> **优先级**：本文件 > 代码注释 > V2 设计文档 > V1 历史文档。
> **规则**：每次代码改动完成后，检查本文件是否需要同步更新。不确定时，更新。

---

## 1. 项目定位

**墨染（MoRan）** — AI 驱动的网文创作工具。用户输入想法，AI 是主要创作者，用户是辅助。

**产品形态**：聊天窗口（左）+ 结构化信息面板（右），用户只与墨衡对话，所有子 Agent 幕后工作。

**V2 是完全重写**，不是 V1 的迭代。V1 代码仅保留基础设施（monorepo 结构、构建配置、Docker）。

---

## 2. 开发方法论 — SDD（Spec-Driven Development）

### 核心原则

**Spec 是 Source of Truth，代码是 Spec 的实现产物。**

### 工作流

```
1. SPEC   → specs/<module>/SPEC.md     定义"做什么"和验收标准
2. DESIGN → specs/<module>/DESIGN.md   定义"怎么做"的技术方案
3. TASKS  → specs/<module>/TASKS.md    拆解有序实现步骤
4. CODE   → packages/<pkg>/src/...     实现代码
5. TEST   → packages/<pkg>/__tests__/  验证 Spec 合规
6. VERIFY → 对照 SPEC.md 逐条检查
```

### 文件结构

```
specs/                          # SDD 规范目录
  infrastructure/               # 基础设施规范
    SPEC.md / DESIGN.md / TASKS.md
  opencode-integration/         # OpenCode 集成规范
    SPEC.md / DESIGN.md / TASKS.md
  chat-ui/                      # 聊天窗口规范
    SPEC.md / DESIGN.md / TASKS.md
  info-panel/                   # 信息面板规范
    SPEC.md / DESIGN.md / TASKS.md
  agents/                       # Agent 系统规范
    SPEC.md / DESIGN.md / TASKS.md
  auth/                         # 认证系统规范
    SPEC.md / DESIGN.md / TASKS.md
  mcp-tools/                    # MCP 工具规范
    SPEC.md / DESIGN.md / TASKS.md
  ...
```

### SDD 规则

- **实现前必须有 SPEC.md**：没有 Spec 不准写代码
- **Spec → Test 直接转换**：验收标准直接变测试用例
- **Spec 先行，代码后行**：先写 SPEC，review 后再实现
- **漂移检测**：代码改了但 Spec 没更新 = 违规

---

## 3. 服务架构

```
用户浏览器
  └── Next.js (web, :3000)          页面渲染 / 静态资源 / Auth 中间件
        └── Hono (api-server, :3200)  所有业务 API + SSE 推送
              └── OpenCode serve (:4096)  AI 对话引擎（Docker）
                    └── LLM Provider (云端)
```

### Monorepo 结构

```
packages/
  web/        Next.js 前端（2 个页面 + 聊天/面板组件 + Zustand store）
  api-server/ Hono 后端（业务 API + OpenCode 集成 + SSE 推送）
  core/       共享库（DB schema, 类型定义, Service 层, 工具函数）
  mcp-server/ MCP 工具服务（OpenCode stdio 传输，54 个工具）
```

> `packages/agents/` 在 V2 中不再使用（Agent prompt 定义在项目根目录 `agents/*.md`，由 OpenCode 自动加载）。

---

## 4. 职责边界（CRITICAL）

### Next.js (packages/web)

- 页面渲染（仅 2 个路由：`/` 项目列表、`/projects/:id` 主工作页）
- 静态资源
- Auth session cookie 校验中间件
- **禁止**写任何业务逻辑 API

### Hono (packages/api-server)

- 所有 RESTful API：`/api/projects/:id/*`
- OpenCode session 管理
- SSE 事件推送（Agent 状态、面板数据更新）
- **禁止**直接调 LLM Provider，必须通过 OpenCode SDK

### 前端调用后端

- Next.js rewrite 代理（同源，消除 CORS）
- 客户端用相对路径 `/api/*`
- rewrite 目标由 `API_UPSTREAM` 环境变量控制

---

## 5. Agent 体系（10 个）

### 核心 Agent（5 个）

| Agent | 英文 | 职责 | 模型 |
|-------|------|------|------|
| 墨衡 | moheng | 唯一用户入口，全流程协调器 | Claude Sonnet 4 |
| 灵犀 | lingxi | 灵感碰撞（发散→聚焦→结晶） | Claude Sonnet 4 (temp 0.9) |
| 匠心 | jiangxin | 世界观/角色/结构设计 | Claude Sonnet 4 |
| 执笔 | zhibi | 章节写作（9 个子写手风格） | 按风格切换模型 |
| 明镜 | mingjing | 四轮质量审校 | Claude Sonnet 4 |

### 支援 Agent（3 个）

| Agent | 英文 | 职责 |
|-------|------|------|
| 载史 | zaishi | 归档记录（章节归档、版本管理） |
| 博闻 | bowen | 知识库管理（一致性校验、知识提取） |
| 析典 | xidian | 九维分析（雷达图、趋势评估） |

### 可选 Agent（2 个）

| Agent | 英文 | 职责 |
|-------|------|------|
| 书虫 | shuchong | 读者视角反馈 |
| 点睛 | dianjing | 标题/简介生成 |

### 执笔子写手（纯文风预设）

子写手定义**文风**（prose voice），不绑定题材。题材技法作为知识库条目（category='genre'）独立存在，由 `context_assemble` 在写作时按需加载。墨衡根据项目题材自动组合文风+题材技法。

> **题材技法管理**：预置题材技法（`source='builtin'`，`scope='global'`）由 seed 脚本管理，项目级题材技法（`source='user'`，`scope='project:{id}'`）由匠心/博闻运行时创建。`context_assemble` 加载时项目级覆盖全局级（同 title 时项目级优先）。

| 子名 | 文风特征 | 推荐模型 |
|------|---------|----------|
| 云墨 | 均衡万用、自然流畅 | Claude Sonnet |
| 剑心 | 冷峻简约、短句、白描、动作化叙事 | Kimi K2 |
| 星河 | 精确、技术感、理性叙述 | GPT-4o |
| 素手 | 温暖细腻、长句、情感细写、氛围渲染 | Claude Opus |
| 烟火 | 市井烟火气、口语化、快节奏 | GPT-4o |
| 暗棋 | 层层递进、信息控制、悬念留白 | Claude Opus |
| 青史 | 典雅庄重、文白混用、时代语感 | Claude Opus |
| 夜阑 | 压抑、感官描写密集、心理暗示 | Gemma4 |
| 谐星 | 轻快、节奏明快、反差幽默 | GPT-4o |

> 显示名称格式：执笔·{子名}（如"执笔·云墨"、"执笔·剑心"）。

模型覆盖优先级：项目级覆盖 > 全局偏好 > 风格默认

---

## 6. 角色系统 — 五维心理模型

### 双维度分类

- **叙事功能**（筛选）：`protagonist / deuteragonist / antagonist / supporting / minor`
- **设计深度**（展示）：`核心层 / 重要层 / 支撑层 / 点缀层`

### 五维心理模型（GHOST → WOUND → LIE → WANT ↔ NEED）

```
GHOST（创伤根源）    过去发生的定义性创伤事件
  ↓ 产生
WOUND（心理伤痕）    此刻仍在运作的持续性心理痕迹（GHOST 与 LIE 的桥梁）
  ↓ 催生
LIE（核心谎言）      为生存形成的错误信念
  ↓ 驱动
WANT（表面欲望）     角色以为自己需要什么
  ↕ 冲突
NEED（真实需求）     角色真正需要什么才能成长
```

- 核心层：必须填写全部五维
- 重要层：至少 LIE/WANT/NEED 三维
- 支撑层/点缀层：无心理模型

### 弧线类型

`positive / negative / flat / corruption`

### 已知代码 Bug

DB 枚举 `characterRoleEnum`（`packages/core/src/db/schema/enums.ts`）缺少 `deuteragonist`，V2 重写时需补上。

---

## 7. UI 关键决策

**权威文档**：`docs/v2-s4-ui-design.md`（2300+ 行，13 个 Section）

| 决策 | 选择 |
|------|------|
| 页面数量 | 2 个（项目列表页 `/` + 主工作页 `/projects/:id`） |
| 核心交互 | 聊天窗口（左）+ 信息面板（右），可拖拽分隔条调节宽度 |
| 信息面板 Tab | 脑暴 / 设定 / 角色 / 大纲 / 章节 / 审校 / 分析 / 知识库 |
| Agent 状态 | 左侧输入框上方状态条，可点击展开会话抽屉 |
| 章节写作 | 不在聊天窗口展示，在右侧 [章节] Tab 流式渲染 |
| 决策建议 | Question Panel 替换输入框，用户选择后恢复 |
| 面板自动切换 | SSE 驱动，但 10 秒操作保护期内不打断用户 |
| 关系可视化 | **不用 Mermaid**，需统一技术选型（角色关系/势力/世界设定均需要） |
| 设定 Tab | 分类标签 + 卡片网格 + 详情页三层结构，标签动态生成不硬编码 |
| 角色 Tab | 双维度（叙事功能 × 设计深度），核心层展示五维心理模型 |

### 设计色系（V1 参考，V2 可调整）

- Primary: `#1A202C`（深海军蓝）
- Background: `#FFFFFF`
- Secondary: `#F1F5F9`
- Border: `#E2E8F0`
- Destructive: `#ef4444`
- Sidebar: `#1A202C`（深色侧边栏）
- Sans 字体: Manrope
- Serif 字体: Noto Serif SC
- 圆角: 0.75rem (12px)
- Tailwind CSS v4 (CSS-first, 无 tailwind.config.ts)
- 无暗色模式（V1 未实现）

---

## 8. OpenCode 集成

- Docker 管理：`docker-compose.dev.yml`，镜像 `ghcr.io/anomalyco/opencode:latest`
- 端口 `4096`，健康检查 `GET /global/health`
- SDK：`@opencode-ai/sdk`，**必须传 `baseUrl`**
- Session = `(userId, projectId)` 一对一映射
- 门禁：MCP 工具内部实现（OpenCode Hook 只有 `file_edited` 和 `session_completed`，不能做门禁）
- 实时事件：SSE `/event/subscribe`
- Agent 间调度：`SubtaskPart`
- 消息持久化：`session.messages()`

---

## 9. 代码规范

### 禁止

- `as any` / `@ts-ignore` / `@ts-expect-error`
- 在 Next.js 里写业务逻辑 API
- 阻塞 Next.js 启动（不能在模块顶层 await）
- 直接调 LLM Provider（必须通过 OpenCode SDK）
- 依赖方向反转（只能 web/api-server → core，不能反向）
- 单文件超过 500 行（提示词/Agent MD 文件除外）。超出时按职责拆分为多个模块文件

### 测试

- 框架：vitest
- Server 路由测试：`createApp()` + `app.request()`，不启动真实 HTTP
- 每个 Spec 对应完整测试套件
- `pnpm test` 运行全部测试
- `pnpm typecheck` 类型检查

### 关系可视化

- **不使用 Mermaid**
- 需要覆盖：角色关系网络、势力结构、世界设定关联
- 要求：节点拖拽、悬停高亮、点击跳转、缩放平移、多层级展开
- **技术选型待定**（候选：D3.js force graph、React Flow、Cytoscape.js、G6）
- 必须在技术方案设计阶段完成选型，一套方案覆盖所有关系图场景

---

## 10. V2 设计文档索引

| 文件 | 内容 | 权威性 |
|------|------|--------|
| `docs/v2-s0-index.md` | 文档目录 | 索引 |
| `docs/v2-s1-overview.md` | V2 总览 | 参考 |
| `docs/v2-s2-architecture.md` | 技术架构 | 参考 |
| `docs/v2-s3-writing-flow.md` | 写作流程 | 参考 |
| **`docs/v2-s4-ui-design.md`** | **UI 交互设计** | **基准文档** |
| `docs/v2-s5-agents.md` | Agent 协作设计 | 参考 |
| `docs/v2-s6-mcp-gates.md` | MCP 工具与门禁 | 参考 |
| `docs/v2-s7-sidechains.md` | 支线链路 | 参考 |
| `docs/v2-s8-error-recovery.md` | 错误恢复 | 参考 |
| `docs/v2-s9-inheritance.md` | V1 继承策略 | 参考 |
| `docs/v2-s10-roadmap.md` | 路线图 | 参考 |
| **`docs/v2-s11-technical-architecture.md`** | **技术方案设计** | **基准文档** |

> V1 设计文档（`docs/project-design-s*.md`）已归档为历史参考，不再作为实现依据。
> 当 V2 文档间有冲突时，技术决策以 `v2-s11-technical-architecture.md` 为准，产品/UI 决策以 `v2-s4-ui-design.md` 为准。

---

## 11. V2 已知文档不一致（已修复）

以下是 cross-check 发现的不一致，**已全部修复**：

| 问题 | 影响文件 | 状态 |
|------|---------|------|
| 心理模型写成 4 维 | v2-s1, v2-s3, v2-s5, v2-s9 | ✅ 已全部使用五维 GHOST/WOUND/LIE/WANT/NEED |
| Agent 数量不一致 | v2-s0 | ✅ 已统一为 10 个 (5核心+3支援+2可选) |
| Agent 列表不完整 | v2-s2, v2-s10 | ✅ 已补全所有 10 个 Agent |
| v2-s2 server→api-server | v2-s2 line 235 | ✅ 已修正为 api-server |

---

## 12. 里程碑状态

### V1（已归档，main 分支 `936a086`）

全部完成：M1.1-1.4, Phase 1-5, 642 tests, typecheck clean

### V2（v2-rewrite 分支，进行中）

| 阶段 | 状态 | 说明 |
|------|------|------|
| 设计文档 | ✅ 完成 | 12 篇 V2 设计文档（含 S11 技术方案） |
| SDD 基础设施 | ✅ 完成 | specs/ 目录、开发流程建立 |
| MCP 工具规范 | ✅ 完成 | specs/mcp-tools/SPEC.md + S6 重写（18 域 54 工具） |
| 文档一致性修复 | ✅ 完成 | V2 文档间不一致已全部修复 |
| V1 代码清理 | ⏳ 待开始 | 删除无用代码，保留基础设施 |
| Spec 编写 | ✅ 完成 | 10 个模块全部完成（含 mcp-tools） |
| 分批实现 | ⏳ 待开始 | 按 Spec 实现 + 测试 |
