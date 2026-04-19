# 新项目设计文档 · §8 实施路径与里程碑

> 本节规划墨染从零到可用的开发路径。遵循"先自用后开源"原则，分四个里程碑递进。
> 关键约束：在用户确认方案定稿前不开始开发。

---

## 8.1 总体路线图

```mermaid
gantt
    title 墨染开发路线图
    dateFormat  YYYY-MM
    axisFormat  %Y-%m

    section M1 核心引擎
    Docker + PostgreSQL + Drizzle 初始化    :m1a, 2026-05, 2w
    记忆引擎 (UNM Core)       :m1b, after m1a, 3w
    Agent 框架 + 墨衡编排      :m1c, after m1b, 2w
    执笔 + 风格引擎            :m1d, after m1c, 2w
    明镜审校系统               :m1e, after m1d, 2w
    M1 验证: 单章写作通路      :milestone, m1done, after m1e, 0d

    section M2 完整流水线
    灵犀 + 匠心 Agent          :m2a, after m1done, 2w
    载史归档 + PostgreSQL 存储   :m2b, after m1done, 2w
    析典 Agent (参考作品 analysis)   :m2f, after m1done, 2w
    Plantser Pipeline          :m2c, after m2a, 2w
    知识库子系统               :m2d, after m2b, 2w
    多章连续写作               :m2e, after m2c, 2w
    M2 验证: 一个弧段(20章)    :milestone, m2done, after m2e, 0d

    section M3 WebUI
    Docker 开发环境            :m3g, after m2done, 1w
    Next.js 项目搭建           :m3a, after m3g, 1w
    阅读面板 + 写作面板         :m3b, after m3a, 3w
    审校面板 + 管理面板         :m3c, after m3b, 2w
    分析面板 (析典报告/沉淀)    :m3f, after m3c, 1w
    SSE 实时状态推送           :m3d, after m3b, 1w
    设定面板 (世界/角色/大纲)   :m3e, after m3f, 2w
    M3 验证: 完整 WebUI 可用   :milestone, m3done, after m3e, 0d

    section M4 打磨与开源
    多版本择优                 :m4a, after m3done, 1w
    扩展 Agent (书虫/点睛)     :m4b, after m3done, 1w
    EPUB/PDF 导出              :m4c, after m4a, 1w
    CI/CD GitHub Actions 搭建  :m4d, after m4b, 1w
    CI/CD 流水线               :m4f, after m4d, 1w
    GitHub Container Registry 发布 :m4g, after m4f, 1w
    文档 + 开源准备            :m4e, after m4c, 2w
    M4: 开源发布               :milestone, m4done, after m4e, 0d
```

---

## 8.2 里程碑详细设计

### M1：核心引擎（约 11 周）

**目标**：实现单章写作的完整通路——从 Brief 到写作到审校到归档。

#### M1.1 项目脚手架与基础设施（2 周）

| 任务 | 产出 | 验证标准 |
|------|------|----------|
| 初始化 monorepo（四包架构） | `@moran/core`、`@moran/agents`、`@moran/server`、`@moran/web` | `bun install` + `bun build` 成功 |
| 配置 TypeScript + ESLint + Prettier | tsconfig、lint 配置 | 零报错 |
| 集成 OpenCode SDK | SDK 初始化 + Agent 注册 | 能成功调用一个空 Agent |
| Docker Compose 开发环境 | docker-compose.yml + docker-compose.test.yml | `docker compose up` 三服务全部 healthy |
| PostgreSQL + Drizzle ORM 集成 | 数据库连接池 + ORM 封装 | Docker 中 PG 启动, drizzle-kit migrate 成功, 基础表创建 |
| Drizzle schema 定义 | 完整数据库 schema（30+表） | generate + migrate 成功 |
| 日志系统 | 结构化日志（pino） | 日志正常输出到文件和控制台 |
| 项目初始化工具 | `moran_init` 命令 | 创建标准目录结构 |
| **配置 Vitest workspace** | `vitest.workspace.ts` + 各包 `vitest.config.ts` | `pnpm test` 空跑成功 |
| **测试基础设施** | `test/setup.ts` + `test/fixtures/` + `test/helpers.ts` (withTestTransaction) | 辅助函数可用，事务回滚模式验证 |
| **覆盖率配置** | v8 provider + 各包阈值配置 | `pnpm test:coverage` 生成报告 |

#### M1.2 记忆引擎 — UNM Core（3 周）

| 任务 | 产出 | 验证标准 |
|------|------|----------|
| MemorySlice 数据结构 | 统一的记忆切片格式 | 能创建/读取/查询 slice |
| ManagedWrite 引擎 | 写入验证 + Canon 保护 + Cap 限制 | 写入受限于预算，违反 Canon 被拒绝 |
| ContextAssembler | 上下文装配引擎 | 能根据权重配置装配 ≤64K tokens 的上下文 |
| 三级摘要系统 | 章节/弧段/全书摘要 | 能正确生成和更新各级摘要 |
| 增长策略管理 | 动态预算分配 | 随章节增加，预算正确调整 |
| **UNM 单元测试** | ManagedWrite / ContextAssembler / BudgetAllocator / SpiralDetector 测试 | 覆盖率 ≥ 80% 语句 |
| **Prompt 快照测试** | ContextAssembler golden test + 自定义序列化器 | 快照稳定，`pnpm test -u` 可更新 |

#### M1.3 Agent 框架 + 墨衡（2 周）

| 任务 | 产出 | 验证标准 |
|------|------|----------|
| Agent 基类设计 | Agent 接口 + 配置格式 | 所有 Agent 统一接口 |
| 墨衡编排逻辑 | 六阶段流程控制 | 能按顺序调度 Agent |
| 螺旋检测 | 审校轮次监控 + 自动中断 | 超过 3 轮自动中断 |
| 成本追踪 | token 消耗统计 | 每次调用记录 token 用量 |
| **SSE 流式管道** | Hono `streamSSE()` 中继 + 事件协议定义 + 心跳保活 | 流式 chunk 可通过 SSE 推送到前端 |

#### M1.4 执笔 + 风格引擎（2 周）

| 任务 | 产出 | 验证标准 |
|------|------|----------|
| 执笔 Agent 实现 | 接收上下文 + 生成章节 | 能产出 ≥2000 字的中文章节 |
| **执笔流式输出** | `stream: true` 调用 + chunk 转发至 SSE | 前端逐字收到输出 |
| 风格配置系统 | 混合格式配置（YAML + 散文 + 示例段落）+ 加载逻辑 | 不同配置产出不同风格文本 |
| 温度场景化 | 根据章节类型自动设定温度 | 日常/高潮章节温度不同 |
| 文风档案拆分 | 核心原则 + 专项模块 | 按需加载正确的模块组合 |
| Anti-AI 自检 | 写作后自检清单 | 自检结果附在提交中 |
| **风格引擎单元测试** | style-manager 加载/合并/覆盖逻辑测试 | 配置加载与合并结果正确 |

#### M1.5 明镜审校系统（2 周）

| 任务 | 产出 | 验证标准 |
|------|------|----------|
| Round 1 AI 味检测 | Burstiness 计算 + 句式分析 + 黑名单 | Burstiness < 0.3 被标记 |
| Round 2 逻辑一致性 | 对照角色/世界观/时间线检查 | 检测到已知矛盾 |
| Round 3 文学质量 | RUBRIC 框架 7 维度评分 | 产出结构化评分报告 |
| 四层反馈格式 | issue/evidence/suggestion/effect | 反馈可被执笔精确理解和执行 |
| 通过标准判定 | 综合分 + Burstiness 硬门槛 | 正确判定通过/不通过 |
| **Burstiness 单元测试** | 已知文本的 burstiness 值验证 | 误差 ≤ 0.05 |
| **句式检测单元测试** | 重复句式模式识别测试 | 正确检出已知问题模式 |

**M1 验证标准**：
- [ ] 从 Brief → 执笔写作 → 明镜审校 → 审校通过/不通过 → 载史归档 的完整单章通路
- [ ] **执笔流式输出可通过 SSE 实时推送到客户端**
- [ ] 审校不通过时能正确反馈给执笔修改
- [ ] 螺旋保护正常工作（3 轮后自动中断）
- [ ] 所有数据正确持久化到 PostgreSQL
- [ ] **`pnpm test` 全量单元测试通过，core 包覆盖率 ≥ 80%**
- [ ] **Prompt 快照测试稳定，无意外变更**

---

### M2：完整流水线（约 12 周）

**目标**：实现从创意脑暴到连续多章写作的完整流程，能在 CLI 模式下写出一个弧段（20 章）。含析典参考作品分析能力。

#### M2.1 灵犀 + 匠心 Agent（2 周）

| 任务 | 产出 |
|------|------|
| 灵犀创意脑暴 | 三阶段方法论 + 结构化创意简报 |
| 匠心世界观设计 | 开放式子系统 + 注册表 |
| 匠心角色设计 | 四维心理模型 + 关系图谱 |
| 匠心结构规划 | 弧段-章节两级规划 + 弧段计划标准格式 |

#### M2.2 载史归档 + PostgreSQL 存储（2 周）

| 任务 | 产出 |
|------|------|
| 载史分层处理 | Haiku 初筛 + Sonnet 核心归档 |
| 增量归档 | 角色状态 delta + 关系变化 |
| PostgreSQL 一致性数据表 | character_states, relationships, timeline_events, plot_threads, locations, factions, secrets, glossary |
| 伏笔追踪 | PLANTED → DEVELOPING → RESOLVED / STALE 状态机 |
| **DB 集成测试** | chapters / characters / locations / plot_threads / knowledge 集成测试 (事务回滚) | ≥ 70% 覆盖率 |

#### M2.3 析典 Agent — 参考作品分析（2 周）

| 任务 | 产出 |
|------|------|
| 析典 Agent 实现 | 九维分析框架（叙事结构/角色/世界观/伏笔/节奏/爽感/文风/对话/钩子） |
| 文学理论 prompt 设计 | 基于 Genette/Propp/Campbell/Enneagram/Sanderson 等理论的分析 prompt |
| 分析报告生成 | 结构化 YAML + 自然语言报告 |
| 知识沉淀管线 | 分析结论 → 知识库条目的转化流程 |
| WebAPI 端点 | `/api/projects/:id/analysis` 提交/查询/沉淀接口 |

#### M2.4 Plantser Pipeline（2 周）

| 任务 | 产出 |
|------|------|
| 三层 Brief 生成 | 匠心根据弧段计划生成章节 Brief |
| 情感地雷植入 | Brief 中自动植入情感地雷 |
| Scene-Sequel 标注 | Brief 中标注建议的 Scene-Sequel 结构 |
| Brief 管理工具 | `moran_brief` CRUD |

#### M2.5 知识库子系统（2 周）

| 任务 | 产出 |
|------|------|
| 知识库 CRUD | 创建/读取/更新/删除 |
| 版本管理 | `knowledge_versions` 表（PostgreSQL），记录每次变更的 diff + 元数据 |
| 分类体系 | 写作技巧/题材知识/风格专项/经验教训 |
| 按需加载 | ContextAssembler 集成 |
| Lessons 自学习 | 审校驱动候选 + 过期淘汰 |

#### M2.6 多章连续写作（2 周）

| 任务 | 产出 |
|------|------|
| `write-next` 命令 | 自动确定下一章并完整执行 |
| `write-loop` 命令 | 连续写作，弧段边界自动暂停 |
| 弧段边界检测 | 弧段最后一章归档后暂停 |
| 恢复机制 | 中断后能从上次位置继续 |

**M2 验证标准**：
- [ ] 从创意脑暴 → 世界/角色设计 → 结构规划 → 连续写作 20 章 的完整通路
- [ ] 弧段边界正确暂停并等待用户确认
- [ ] 知识库在写作过程中正确加载和更新
- [ ] PostgreSQL 一致性数据正确记录 20 章的角色状态、伏笔和时间线
- [ ] 析典能对参考作品完成九维分析并生成结构化报告
- [ ] 析典分析结论能成功沉淀到知识库
- [ ] **单元测试覆盖率达标：core ≥ 80%、server ≥ 70%**
- [ ] **DB 集成测试全部通过，事务回滚隔离正常**
- [ ] **API 集成测试 (Hono testClient) 覆盖主要路由**

---

### M3：WebUI（约 10 周）

**目标**：实现完整的 WebUI，覆盖阅读、写作、审校、管理、分析、设定、可视化七大面板。

详细设计见 §5 WebUI 设计。此处仅列关键任务：

| 子阶段 | 关键任务 | 周期 |
|--------|----------|------|
| M3.1 Docker 开发环境 | 完善开发用 Docker 配置，集成 PG 监控工具 | 1 周 |
| M3.2 脚手架 | Next.js 15 + shadcn/ui + Tailwind v4 + 路由 | 1 周 |
| M3.3 阅读+写作面板 | 章节阅读、**流式写作渲染（逐字输出+光标动画+自动滚动+暂停续写）**、版本对比 | 3 周 |
| M3.4 审校+管理面板 | 审校报告展示、lesson 管理、成本统计 | 2 周 |
| M3.5 分析面板 | 析典报告展示、九维视图、知识沉淀操作 | 1 周 |
| M3.6 SSE 实时推送 | Agent 状态、**流式写作实时推送（含心跳保活+断线重连+Last-Event-ID 恢复）**、审校结果、分析进度实时推送 | 1 周 |
| M3.7 设定面板 | 世界观编辑器、角色关系图、大纲树、风格配置编辑 | 2 周 |
| M3.8 可视化面板 | 人物关系图 (Cytoscape.js) + 地点层级树 (D3) + 事件时间线 (vis-timeline) | 2 周 |

**M3 验证标准**：
- [ ] 所有七大面板可用
- [ ] 写作过程中 WebUI **流式逐字显示**执笔输出，光标动画与自动滚动正常
- [ ] **暂停/续写功能正常**：暂停后保存草稿，续写从编辑点继续
- [ ] **SSE 断线重连正常**：网络中断后自动恢复，内容不丢失
- [ ] 用户可在 WebUI 中审阅和修改审校结果
- [ ] 分析面板可提交参考作品分析、查看报告、沉淀知识
- [ ] 设定面板可编辑世界观、角色、大纲、风格配置
- [ ] **可视化面板三个视图正常渲染和交互**（人物关系图、地点层级树、事件时间线）
- [ ] **E2E 测试 (Playwright) 覆盖 7 个关键场景（对应七大面板）**
- [ ] **web 组件单元测试覆盖率 ≥ 60%**

---

### M4：打磨与开源（约 6 周）

**目标**：补齐高级功能，打磨体验，准备开源发布。

| 子阶段 | 关键任务 | 周期 |
|--------|----------|------|
| M4.1 多版本择优 | 爆点章 2-3 版本生成 + 差异锚点评估 | 1 周 |
| M4.2 扩展 Agent | 书虫（读者评审）+ 点睛（文学批评） | 1 周 |
| M4.3 导出 | EPUB/PDF 导出 + 格式美化 | 1 周 |
| M4.4 Docker 生产配置 | Multi-stage Dockerfile, docker-compose.prod.yml, health checks, restart policies | 1 周 |
| M4.5 CI/CD 流水线 | 五条独立流水线 (ci-unit / ci-integration / ci-e2e / docker-publish / db-migrate) + 覆盖率门槛 + Docker build+push to ghcr.io + DB migration automation | 1 周 |
| M4.6 开源准备 | 文档、README、LICENSE、示例项目 | 2 周 |

**M4 验证标准**：
- [ ] 多版本择优在爆点章正常工作
- [ ] Docker 一键部署成功
- [ ] README 和使用文档完整
- [ ] 示例项目可运行
- [ ] **五条 CI/CD 流水线全部通过（ci-unit / ci-integration / ci-e2e / docker-publish / db-migrate）**
- [ ] **覆盖率门槛 CI 硬性拦截：core ≥ 80%、server ≥ 70%、web ≥ 60%**

---

## 8.3 技术风险与缓解

| 风险 | 影响 | 概率 | 缓解策略 |
|------|------|------|----------|
| OpenCode SDK API 变更 | 所有 Agent 调用需要适配 | 中 | 封装 SDK 调用层，隔离变更影响 |
| 模型 API 成本超预期 | 多版本择优和多轮审校成本高 | 高 | 分层降本（Haiku/Sonnet）+ 多版本仅用于爆点章 |
| Burstiness 检测误报 | 正常文本被错误标记为 AI 味 | 中 | 建立校准数据集，调整阈值 |
| PostgreSQL 运维复杂度 | 用户部署门槛增加 | 低 | Docker 封装，用户无需手动安装管理 |
| Docker 环境依赖 | 跨平台兼容性问题 | 中 | 提供详细安装文档，支持 Docker Desktop (Win/Mac) + 原生 Linux |
| 数据库迁移风险 | 数据丢失或不一致 | 低 | Drizzle Kit 生成可审查的 SQL 迁移文件，CI 中自动验证 |
| 三层 Brief "呆板 vs 无聊"平衡 | 硬约束太多→仍然呆板 | 高 | 从少量硬约束开始，逐步调整平衡点 |
| 上下文窗口不够 | 风格+知识库+摘要+Brief 超出 64K | 中 | ContextAssembler 动态裁剪 + 优先级排序 |

---

## 8.4 开发原则

1. **增量可验证** — 每个子阶段都有明确的验证标准，不等全部完成再测试
2. **测试先行** — 新模块先写测试骨架（接口约定），再写实现。核心模块必须有单元测试覆盖后才合入
3. **先 CLI 后 WebUI** — M1-M2 在 CLI 模式下完成核心验证，M3 再加 WebUI 壳
4. **数据优先** — 先定 PostgreSQL schema (Drizzle)，再写业务逻辑
5. **写作驱动** — 所有功能优先级以"对写作质量的影响"排序
6. **成本感知** — 每个功能设计时考虑 token 消耗，避免"功能很好但用不起"
7. **容器化优先** — 开发环境即 Docker，保证开发/生产环境一致性

---

## 8.5 自用阶段验收标准

在开源发布前，墨染需要通过以下自用验收：

| 验收项 | 标准 |
|--------|------|
| 连续写作能力 | 能连续写出 50 章（一个完整弧段），无需人工干预归档/一致性 |
| 写作质量 | 明镜审校通过率 ≥ 70%（首次提交） |
| AI 味控制 | Burstiness 均值 ≥ 0.35，无连续 3+ 章 Burstiness < 0.3 |
| 呆板度控制 | RUBRIC 呆板度评分均值 ≥ 7.0 |
| 一致性 | 50 章内无重大设定矛盾（Round 2 CRITICAL = 0） |
| 恢复能力 | 任意中断后能正确恢复继续 |
| Docker 部署 | `docker compose up` 三服务全部 healthy，冷启动 < 30 秒 |
| CI/CD | 五条流水线全部通过（ci-unit / ci-integration / ci-e2e / docker-publish / db-migrate），覆盖率门槛拦截生效 |
| 测试覆盖率 | core ≥ 80% 语句 / server ≥ 70% / web ≥ 60% |
| WebUI 可用性 | 所有七大面板功能正常，SSE 实时推送无明显延迟 |
| 成本 | 每章平均成本可接受（具体数字待 M1 后校准） |
