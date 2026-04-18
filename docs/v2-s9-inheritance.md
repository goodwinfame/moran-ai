# S9 — 与原设计继承关系

> 一句话导读：墨染 V2 并非对 V1 的全盘否定，而是通过架构重组（从代码编排到 Agent 编排）将 V1 沉淀的所有原子文学能力无损迁移至更灵活的 MCP 生态。

---

## 1. 完整保留清单

V1 中经过实战验证的文学创作逻辑、算法策略及数据库 Schema 在 V2 中得到完整保留。变化仅在于触发方式：从 V1 的 Orchestrator 代码硬调用，转变为 V2 中由“墨衡”Agent 根据用户意图进行的 MCP 工具委派。

| V1 能力 | V2 保留方式 |
|---------|------------|
| **UNM 记忆引擎**（六大类别、三层存储、ManagedWrite 5阶段管线、ContextAssembler 3阶段） | 核心算法逻辑不变，实现位置从 `core/engine` 移至 `mcp-writing` 工具内部模块。 |
| **四轮审校**（AI味/逻辑/文学质量/读者体验） | 审校流程与评估维度不变，触发从代码循环改为“墨衡”委派“明镜”执行。 |
| **风格引擎**（混合格式：YAML+散文+示例，9种预设风格，诗意子名） | 完全保留。风格配置的解析逻辑与提示词注入结构保持一致。 |
| **温度场景化策略**（5种章节类型 → 5个温度区间） | 完全保留。针对草稿、润色、爆点章等不同任务动态调整 LLM 温度。 |
| **Plantser Pipeline**（三层Brief：硬约束/软引导/自由区，情感地雷） | 完全保留。作为写作任务下发给“执笔”Agent 的核心上下文。 |
| **Scene-Sequel 原子单元** | 完全保留。作为微观剧情构建的最小逻辑单位。 |
| **析典九维分析**（9个学术理论框架） | 完全保留。由“析典”Agent 调用专用分析工具执行。 |
| **知识库五类**（写作技巧/题材知识/风格专项/经验教训/析典沉淀） | 完全保留。存储结构与检索策略（Consumer 标签加载）保持兼容。 |
| **Consumer 标签加载策略**（Eager/Selective/On-demand/Filtered/Tagged） | 完全保留。优化了 MCP 环境下的注入效率。 |
| **四维心理模型**（WANT/NEED/LIE/GHOST） | 完全保留。作为角色设定中的核心字段。 |
| **开放式世界子系统** | 完全保留。支持设定间的层级嵌套与冲突检测。 |
| **弧段-章节两级规划** | 完全保留。通过 MCP 工具链进行结构化存储。 |
| **跨模型族审校原则** | 完全保留。强制要求审校模型与生成模型处于不同系列（如 Claude 审校 GPT）。 |
| **分层归档**（Haiku初筛 + Sonnet核心归档） | 完全保留。降低长期记忆维护成本，提升摘要质量。 |
| **版本化存档**（chapter_versions + Git里程碑） | 完全保留。支持随时回溯至任何历史创作状态。 |
| **持久化通信**（Agent 通过 DB 通信） | 完全保留。Agent 不直接传递复杂对象，仅传递 DB ID。 |
| **四层审校反馈格式**（issue/severity/evidence/suggestion/expected_effect） | 完全保留。结构化反馈便于 Agent 自动化执行迭代。 |
| **Burstiness 硬门槛**（≥0.3） | 完全保留。作为“明镜”判定 AI 味的核心指标。 |
| **呆板度检测**（4子维度） | 完全保留。检测句子长度分布、重复词频等。 |
| **多版本择优**（爆点章 2-3 版本） | 完全保留。支持用户在多版本间进行局部融合或整体选择。 |
| **螺旋检测 3 种模式** | 完全保留。防止逻辑回环与角色动机崩坏。 |
| **30+ 表 PostgreSQL Schema** | 完全保留。核心数据资产无需迁移，Drizzle ORM 定义兼容 V1。 |

---

## 2. 调整清单

V2 的核心改进在于“架构降噪”，去除了多层抽象，使 AI 能直接触达工具与数据。

| 维度 | V1 设计 | V2 调整 | 调整原因 |
|------|---------|---------|----------|
| **编排层** | Hono 后端 Orchestrator 状态机硬编排（Engine层 → Bridge层 → OpenCode） | OpenCode 内部编排（“墨衡”通过 `SubtaskPart` 调度子 Agent） | 消除四层间接调用，减少 Token 损耗与响应延迟。 |
| **Session 模型** | 每个子 Agent 拥有独立 Session | 项目唯一“墨衡”Session，子 Agent 在同一上下文中协作 | 统一全局记忆，避免上下文在不同 Agent 间切换时丢失。 |
| **前端架构** | 多页面筹备向导 + 7面板写作台（15+ 页面） | 单页面：聊天窗口 + 信息面板（2个页面：首页 + 工作页） | 简化交互，将所有创作行为收束于对话逻辑。 |
| **数据流** | 前端 → Hono → Engine → Bridge → OpenCode → LLM | 前端 → Hono → OpenCode(“墨衡”) → MCP → DB | 压缩路径，让 AI 具备更强的自主性与实时响应力。 |
| **工具系统** | Engine 层解析 LLM 输出后手动调用 DB | MCP 工具直接操作 DB，读写门禁内置于工具函数内 | 工具自治，无需编排层再做“搬运工”。 |
| **前端状态** | Zustand 内存状态（刷新即丢失） | OpenCode Session 持久化 + DB 结构化数据同步 | 彻底解决复杂创作任务中途断电、刷新导致的进度丢失。 |
| **流程控制** | 代码状态机（if/switch 硬编码阶段转换） | “墨衡”对话引导 + MCP 门禁双层保障 | 允许用户在自然对话中跨越流程（如写作中途修改设定）。 |
| **用户入口** | 直接与各子 Agent 交互（需手动选择 Agent） | 仅与“墨衡”对话，“墨衡”根据任务自动委派 | 降低心智负担，用户无需理解底层 Agent 职责。 |
| **UNM 实现位置** | 独立于 Engine 层的复杂 TS 模块 | 封装于 `mcp-writing` 工具集内部 | 随编排层重心下沉，保持业务逻辑的内聚性。 |
| **SSE 协议** | Hono 维护的自定义 SSE 事件流 | Hono 纯代理转发 OpenCode 原生 SSE | 减少协议转换层，提升流式输出的稳定性。 |

---

## 3. 废弃清单

为了实现 V2 的“极简核心”，以下模块已从工程中移除或被完全重写。

| V1 能力/模块 | 废弃原因 | V2 替代方案 |
|-------------|----------|---------|
| **Orchestrator 状态机** | 硬编码的流程难以适应灵活的创作变动 | “墨衡”Agent 的意图对齐与任务规划 |
| **Engine 层** | 沦为单纯的 API 转发与数据清洗层，维护成本高 | MCP 原生函数调用 |
| **Bridge 层** | 在 OpenCode SDK 成熟后，抽象层显得冗余 | `@opencode-ai/sdk` 直接驱动 |
| **BridgeTransport** | 基于 SSE 的远程传输抽象不再必要 | MCP 标准通信协议 |
| **15+ 页面路由** | 碎片化的页面割裂了创作体验 | 统一的工作空间（Chat + SidePanel） |
| **7 面板写作台** | 占用屏幕空间过大，信息密度冗余 | 信息面板的 8 个按需切换 Tab |
| **Zustand 会话状态** | 无法跨设备、跨 Session 同步 | DB 存储 + OpenCode 消息历史 |
| **Intent 路由** | Hono 层的正则解析无法处理复杂口语意图 | “墨衡”LLM 的自然语言理解能力 |
| **Agent 独立 Session** | 导致每个 Agent 都要重新加载项目背景（浪费 Token） | 统一 Project-Level Session |
| **`core` SessionManager** | 与 OpenCode 自带的 Session 管理冲突 | 直接使用 OpenCode 原生 API |

---

## 4. 文档继承关系映射

V2 的文档体系是对 V1 的重新梳理与扩充，确保每一个设计决策都有迹可循。

| V1 文档 | V2 对应文档 | 关系说明 |
|---------|---------|----------|
| S1 定位 | `v2-s1-overview.md` | 核心定位保留，新增 V1→V2 变化矩阵。 |
| S2 架构 | `v2-s2-architecture.md` | 架构由“四层”重构为“两层”，强化 OpenCode 核心地位。 |
| S3 记忆引擎 | `v2-s7-sidechains.md` | UNM 算法逻辑保留，详述其在 MCP 下的侧链化实现。 |
| S4 Agent 体系 | `v2-s5-agents.md` + `v2-s3-writing-flow.md` | 10 个 Agent 的职责合并，重构交互模型。 |
| S5 WebUI | `v2-s4-ui-design.md` | 彻底重写，从多组件布局转为 Chat-First 布局。 |
| S6 结构 | `v2-s6-mcp-gates.md` | 数据库 Schema 章节保留，重点增加 MCP 工具链映射。 |
| S7 继承关系 | `v2-s9-inheritance.md` | 本文件，增加了 Dickens 到 V2 的三代演进。 |
| S8 路线图 | `v2-s10-roadmap.md` | 结合 V2 的开发周期重新规划。 |
| S9 部署 | `v2-s2-architecture.md` | 简化部署流程，合入整体架构。 |
| product-design | `v2-s3-writing-flow.md` + `v2-s4-ui-design.md` | 转化为更具体的功能实现文档。 |

---

## 5. 工具链演进映射 (Dickens → V1 → V2)

原 Dickens 工具组在 V2 中被解构成更原子、更安全的 MCP 工具。

| Dickens 工具 | V1 墨染工具 | V2 MCP 工具 | 变化说明 |
|-------------|------------|------------|----------|
| `dickens_init` | `moran_init` | `project_create` | 增加配额校验与初始化模板选择。 |
| `dickens_status` | `moran_status` | `project_status` | 提供更丰富的可视化进度指标。 |
| `dickens_outline` | `moran_outline` | `outline_create` / `outline_update` | 原子化，防止长文本写入导致的超时。 |
| `dickens_character` | `moran_character` | `character_create` / `update` / `read` / `list` / `archive` / `relationship` | 拆分为 6 个精细工具，支持关系网自动构建。 |
| `dickens_world` | `moran_world` | `world_create` / `update` / `read` / `list` / `subsystem_create` / `subsystem_update` | 强化世界观子系统的层级管理。 |
| `dickens_write_chapter` | `moran_write` | `chapter_write` / `draft_save` / `continue` | 支持草稿态与发布态的分离，支持断点续写。 |
| `dickens_summary` | `moran_summary` | `archive_chapter` (内含) | 摘要不再作为独立动作，而是归档的自动化产物。 |
| `dickens_consistency` | 手动查询 | `archive_chapter` + `consistency_check` | 写入时自动提取，读取时提供冲突报告。 |
| `dickens_context` | `moran_context` | 内部 `ContextAssembler` | 隐藏底层实现，Agent 仅需声明所需背景类别。 |
| `dickens_document` | `moran_document` | `brainstorm_create` / `update` / `select` | 脑暴逻辑专用化，支持多版本灵感对比。 |
| `dickens_doctor` | `moran_doctor` | `project_diagnose` | 扩展至包含 Token 审计与 MCP 健康度检查。 |
| `dickens_export` | `moran_export` | `export_to_format` | 增加自定义排版引擎支持。 |
| `dickens_lesson` | `moran_lesson` | `lesson_learn` / `lesson_confirm` | 强化人机协同，用户纠错后需确认才入库。 |
| `dickens_versions` | `moran_versions` | `version_history_read` | 基于 Git 逻辑的轻量化实现。 |
| **(新增)** | `knowledge_base` | `knowledge_create` / `read` / `update` / `delete` | 完整的外部知识库 CRUD。 |
| **(新增)** | `style_config` | `style_preset_apply` / `style_custom_save` | 风格引擎工具化。 |
| **(新增)** | `brief_generator` | `brief_refine` / `brief_validate` | Plantser 管线的前置校验。 |
| **(新增)** | `writing_metrics` | `get_writing_statistics` | 创作频率、情感曲线、节奏统计。 |
| **(新增)** | `literary_analysis` | `analysis_submit` / `analysis_status` | 析典长程异步分析任务。 |
| **(新增)** | — | `review_submit` / `review_round` / `review_decision` | 明镜审校专用流水线。 |
| **(新增)** | — | `archive_rollback` / `archive_status` | 归档链条的回滚与状态查看。 |

---

## 6. 设计理念继承

墨染 V2 是理念的集大成者，在继承前代精髓的基础上，向“AI 原生”迈进。

```mermaid
graph TD
    subgraph Dickens [Dickens 核心 (6)]
        D1[持久化优先]
        D2[流式交互]
        D3[跨模型审校]
        D4[全量版本化]
        D5[教训自愈]
        D6[螺旋检测]
    end

    subgraph V1 [墨染 V1 (10)]
        V1_1[Dickens 核心]
        V1_2[UNM 记忆引擎]
        V1_3[Plantser 管线]
        V1_4[四轮审校体系]
        V1_5[析典理论框架]
    end

    subgraph V2 [墨染 V2 (14)]
        V2_1[V1 核心理念]
        V2_2[MCP-First]
        V2_3[Single-Entry-Point]
        V2_4[Gate-as-Code]
        V2_5[Session-Unified]
    end

    Dickens --> V1
    V1 --> V2
```

### 理念演进说明：
1. **从 Dickens 继承**：确立了“写作是长程任务”的基调，强调数据的主权与模型间相互制约。
2. **从 V1 发展**：将写作提升到“工程化”高度，引入了系统的记忆管理与结构化的审校标准。
3. **V2 的跨越**：
   - **MCP-First**：工具不再是代码的奴隶，而是 Agent 的感官延伸。
   - **Single-Entry-Point**：从“工具箱”模式回归到“助手”模式。
   - **Gate-as-Code**：通过 MCP 门禁确保文学逻辑的刚性执行。
   - **Session-Unified**：消除 AI 的“人格分裂”，维持统一的世界观与创作风格。
