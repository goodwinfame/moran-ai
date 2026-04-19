# 墨染 AI — 差距分析报告

> 生成时间：2026-04-17
> 对照来源：product-design.md + project-design-s1~s9
> 评估方法：逐模块代码审查（非推测）

---

## 一、总体评估

| 层级 | 已实现 | 差距 | 阻塞因素 |
|------|--------|------|----------|
| DB Schema | 30 表 + 26 枚举 ✅ | 无 | — |
| Core 引擎层 | 11 个引擎全部有代码 | 全部依赖 Bridge，LLM 调用返回 placeholder | Bridge M1.4 |
| Server 路由 | 18 路由中 15 个真实 DB | stats/export 仍读假数据；AI POST 端点返回 mock | Bridge M1.4 + 路由修复 |
| 前端 | 15 页中 2 个真实可用 | 13 页是静态 HTML 或 placeholder | 后端 API 先到位 |
| UNM 记忆引擎 | ManagedWrite/ContextAssembler/SpiralDetector 有代码 | 使用 InMemory store，未接 DB | DB 适配器 |
| 知识库 | KnowledgeService + InMemoryStore 有代码 | 未接 DB | DB 适配器 |

**一句话结论**：Core 包的引擎代码量巨大且逻辑完整，但**全部通过 Bridge 调 LLM，而 Bridge 是 placeholder**。这是唯一的系统性阻塞点。解除此阻塞后，80% 的功能可快速串联。

---

## 二、逐模块差距明细

### 2.1 Bridge（SessionProjectBridge）— 🔴 M1.4 关键阻塞

**文件**：`packages/core/src/bridge/bridge.ts`（152 行）

| 方法 | 现状 | 设计要求 |
|------|------|----------|
| `ensureSession()` | 返回 `moran-session-${projectId}-${Date.now()}` | 调用 OpenCode SDK `session.create()` |
| `invokeAgent()` | 返回 `[Placeholder] Agent ...` 字符串 | 调用 `session.prompt()` 并支持流式 |
| 流式支持 | 无 | `stream: true` → chunk 回调 |

**影响范围**：WriterEngine、ReviewEngine、ZaishiEngine、JiangxinEngine、LingxiEngine（非 intent 路由版）、DianjingEngine、ShuchongEngine、PlantserPipeline — **所有 AI 功能**。

**解法**：Bridge 对接 `packages/server/src/opencode/manager.ts`（已验证可用的 OpenCode SDK 集成）。

---

### 2.2 Server 路由层

#### 2.2.1 stats.ts — 🔴 硬编码 demo 数据

**现状**：3 个 GET 端点全部返回 `demoProgress()` / `demoCost()` / `demoUNM()` / `demoForeshadow()` 硬编码函数。

**设计要求**：
- `GET /` — 从 chapters/projects 表聚合 totalWords/totalChapters/completionPercentage
- `GET /cost` — 从 agentLogs 表聚合 token 消耗和成本
- `GET /foreshadow` — 从 plotThreads 表读取伏笔状态

#### 2.2.2 export.ts — 🔴 读 demoStore Map

**现状**：内部维护 `demoStore = new Map<string, ChapterRecord[]>()` + `seedDemoChapters()`。

**设计要求**：从 chapters 表 + projects 表读取真实数据。

#### 2.2.3 AI POST 端点 — 🔴 返回 mock 数据

| 路由 | POST 行为 | 设计要求 |
|------|-----------|----------|
| `reviews.ts` POST `/:chapterNum` | 生成硬编码 ReviewRound（随机 issues） | 调用 ReviewEngine → Bridge → LLM |
| `diagnosis.ts` POST `/` | 生成硬编码诊断报告 | 调用 DianjingEngine → Bridge → LLM |
| `reader-review.ts` POST `/:chapterNum` | 生成硬编码读者评分 | 调用 ShuchongEngine → Bridge → LLM |
| `analysis.ts` POST `/` | 生成硬编码分析结果 | 调用 XidianEngine → Bridge → LLM |

#### 2.2.4 writing.ts — 🟡 框架在但无真实 LLM

**现状**：
- Orchestrator 状态机 ✅ 运转正常
- ChapterPipeline ✅ 完整流程代码
- 但 `getPipeline` 在 app.ts 中未注入真实实例
- 回退到 `orchestrator-only` 模式（仅状态转换，不生成内容）

**设计要求**：
- Pipeline 注入真实 Bridge → WriterEngine 生成内容 → ReviewEngine 审校 → ZaishiEngine 归档
- SSE 流式推送 writing chunk 到前端

#### 2.2.5 筹备对齐路由 — 🔴 缺失

设计文档要求的筹备流程路由当前不存在：

| 路由 | 状态 | 说明 |
|------|------|------|
| `POST /api/projects/:id/world/align` | 🔴 缺失 | 世界观对齐（调 JiangxinEngine） |
| `POST /api/projects/:id/characters/align` | 🔴 缺失 | 角色对齐（调 JiangxinEngine） |
| `POST /api/projects/:id/styles/align` | 🔴 缺失 | 文风对齐（调 StyleManager） |
| `POST /api/projects/:id/outline/align` | 🔴 缺失 | 大纲对齐（调 JiangxinEngine） |

注：world/characters/outline/styles 路由存在 CRUD GET/POST/PUT，但缺少 AI 对齐端点。

---

### 2.3 Core 引擎层

| 引擎 | 文件 | 代码量 | 状态 | 差距 |
|------|------|--------|------|------|
| Orchestrator | orchestrator.ts | ~300 行 | ✅ 完整 | 无 |
| ChapterPipeline | chapter-pipeline.ts | 472 行 | ✅ 完整 | 需注入真实 Bridge |
| WriterEngine | writer-engine.ts | 339 行 | ✅ 完整 | 需真实 Bridge |
| ReviewEngine | review-engine.ts | 285 行 | ✅ 完整 | 需真实 Bridge |
| ZaishiEngine | zaishi-engine.ts | 486 行 | ✅ 完整 | 需真实 Bridge |
| LingxiEngine | lingxi-engine.ts | ~200 行 | ✅ 完整 | intent 路由已绕过它直接用 SDK |
| JiangxinEngine | jiangxin-engine.ts | ~300 行 | ✅ 完整 | 需真实 Bridge + 对齐路由 |
| DianjingEngine | dianjing-engine.ts | ~200 行 | ✅ 完整 | 需真实 Bridge |
| ShuchongEngine | shuchong-engine.ts | ~200 行 | ✅ 完整 | 需真实 Bridge |
| PlantserPipeline | plantser-pipeline.ts | ~200 行 | ✅ 完整 | 需真实 Bridge |
| StyleManager | style-manager.ts | ~200 行 | ✅ 完整 | 无 |
| Anti-AI Checker | anti-ai-checker.ts | ~150 行 | ✅ 完整 | 无（纯代码检测） |
| KnowledgeService | knowledge-service.ts | 151 行 | ✅ 完整 | 需 DB 适配器 |
| UNM ManagedWrite | managed-write.ts | 101 行 | ✅ 完整 | 需 DB 适配器 |
| UNM ContextAssembler | context-assembler.ts | 184 行 | ✅ 完整 | 需 DB 适配器 |
| UNM BudgetAllocator | budget-allocator.ts | ~100 行 | ✅ 完整 | 无 |
| UNM SpiralDetector | spiral-detector.ts | ~150 行 | ✅ 完整 | 需 DB 适配器 |
| VersionSelector | version-selector.ts | ~100 行 | ✅ 完整 | 需真实 Bridge |

**结论**：Core 引擎层代码完备。唯一差距是 Bridge placeholder 和 InMemory store → DB 适配器。

---

### 2.4 前端页面

#### 已实现（真实可用）：
- ✅ 首页 (`/`) — 项目列表
- ✅ 意图对齐 (`/projects/[id]/prep/intent`) — 真实 API 调用 + 对话 UI

#### 筹备阶段页面（静态 HTML，无 API 调用）：
- 🔴 世界观对齐 (`/prep/world`) — 硬编码"苍穹大陆"数据
- 🔴 角色对齐 (`/prep/characters`) — 硬编码数据
- 🔴 文风对齐 (`/prep/style`) — 硬编码数据
- 🔴 大纲对齐 (`/prep/outline`) — 硬编码数据
- 🔴 准备就绪 (`/prep/ready`) — 硬编码数据

#### 正式写作阶段页面（placeholder）：
- 🔴 写作面板 (`/write`) — 仅一个"写下第一章"按钮，onClick 空函数
- 🔴 审校面板 (`/review`) — placeholder
- 🔴 管理面板 (`/manage`) — placeholder
- 🔴 分析面板 (`/analysis`) — placeholder
- 🔴 设定面板 (`/settings`) — placeholder
- 🔴 可视化面板 (`/visualize`) — placeholder
- 🔴 阅读面板 (`/read`) — placeholder

#### 前端基础设施（已就绪）：
- ✅ AlignmentLayout 双栏布局组件
- ✅ ChatPanel / MessageBubble / ChatInput 对话组件
- ✅ ResultPanel / SchemeTabs 结果面板组件
- ✅ 写作组件：StreamingWriteView, WriteControls, WriteProgress, VersionComparison, ConnectionIndicator, ContextOverview
- ✅ 13 个数据 hooks（useChapters, useCharacters, useOutline 等）
- ✅ 3 个 Zustand stores（preparation, project, writing）
- ✅ 布局组件（ProjectLayout, Sidebar 等）

**结论**：前端组件库已经很充分，但页面没有接入真实 API。一旦后端对齐路由就绪，接入工作量不大。

---

### 2.5 UNM 记忆引擎

**设计文档要求（s3）**：
- MemorySlice 统一数据模型 ✅（types.ts + schemas.ts 已定义）
- ManagedWrite 5 阶段写入管线 ✅（验证→分类→增量化→路由→背压）
- ContextAssembler 3 阶段读取管线 ✅（SceneAnalyzer→BudgetAllocator→SliceRenderer）
- 各类别增长控制策略 ✅（growth/ 目录）
- 螺旋检测 ✅（spiral-detector.ts）

**差距**：使用 `InMemorySliceStore`，未接 DB（memorySlices 表已存在于 schema）。

---

### 2.6 知识库子系统

**设计文档要求（s4 §4.11）**：
- CRUD + 版本管理 ✅（KnowledgeService 已实现）
- 按需加载 ✅（KnowledgeLoader 已实现）
- 作用域隔离（global/project/chapter） ✅（类型已定义）
- 消费者标签 ✅（findByConsumer 接口已定义）

**差距**：使用 `InMemoryKnowledgeStore`，未接 DB（knowledgeEntries + knowledgeVersions 表已存在于 schema）。

---

### 2.7 SSE 流式管道

**设计文档要求（s2 §2.4）**：
- 三层流式管道：LLM(stream:true) → Hono SSE → EventSource ✅（events.ts 框架完整）
- 8 类事件：context/writing/reviewing/review/archiving/done/error/heartbeat ✅（EventBus 类型已定义）
- Last-Event-ID 断线重连 ✅（events.ts 已实现回放）
- EventBuffer 缓冲 ✅（EventBus 已实现）

**差距**：writing.ts 的 pipeline 未注入，所以 SSE 事件不会被真正触发。Bridge 解决后此处自动串联。

---

## 三、差距优先级矩阵

| 优先级 | 差距 | 影响范围 | 工作量 | 依赖 |
|--------|------|----------|--------|------|
| **P0** | Bridge M1.4（ensureSession + invokeAgent 接真实 SDK） | 所有 AI 功能 | 中 | SessionManager 已可用 |
| **P1** | 写作管道串联（writing.ts 注入 Pipeline + Bridge） | 写作流程 | 中 | Bridge |
| **P1** | 筹备对齐路由（world/characters/style/outline align） | 筹备流程 | 中 | Bridge |
| **P1** | stats.ts 迁移到真实 DB 聚合 | 统计面板 | 小 | 无 |
| **P1** | export.ts 迁移到真实 DB | 导出功能 | 小 | 无 |
| **P2** | AI POST 端点接引擎（reviews/diagnosis/reader-review/analysis） | 审校/分析 | 中 | Bridge |
| **P2** | UNM SliceStore DB 适配器 | 记忆引擎 | 中 | 无 |
| **P2** | KnowledgeStore DB 适配器 | 知识库 | 中 | 无 |
| **P3** | 筹备前端页面接 API（world/characters/style/outline/ready） | 筹备 UI | 中 | P1 对齐路由 |
| **P3** | 写作前端页面接 API（write） | 写作 UI | 中 | P1 写作管道 |
| **P3** | 其他前端页面（review/manage/analysis/settings/visualize/read） | 各面板 | 大 | P2 后端 |
| **P4** | 全量端到端测试 | 质量保障 | 大 | 以上全部 |

---

## 四、关键发现

1. **Core 引擎层代码量 > 3000 行，逻辑完整**。这是好消息——不需要重写引擎，只需要解除 Bridge 阻塞。
2. **Bridge 是唯一的系统性阻塞点**。解决 Bridge 后，写作管道（Pipeline）、审校（ReviewEngine）、归档（ZaishiEngine）可以一次性串联。
3. **intent 路由已经证明了 OpenCode SDK 的可行性**。Bridge 可以复用相同模式。
4. **前端组件库已经很充分**。StreamingWriteView、WriteControls 等写作组件已存在，只需要在页面中使用并连接 API。
5. **DB Schema 与 Core 引擎的类型定义有少量不匹配**，需要适配层。
6. **产品设计中的"数据策略"要求移除所有 demo 假数据**——stats.ts 和 export.ts 是最后两个残留。
