# 墨染 AI — 实施计划

> 生成时间：2026-04-17
> 依据：docs/gap-analysis.md

---

## 执行原则

1. **先解除阻塞，再并行铺开** — Bridge 是唯一系统性阻塞点，必须先完成
2. **由内到外** — Core → Server → Web 的依赖方向
3. **可验证** — 每个阶段完成后都能运行测试确认
4. **增量交付** — 每个 Phase 独立可用，不存在"全做完才能跑"

---

## Phase 1：解除 Bridge 阻塞 + 清理残留假数据

### 1.1 Bridge M1.4 集成（P0，阻塞一切 AI 功能）
- **文件**：`packages/core/src/bridge/bridge.ts`
- **任务**：
  - `ensureSession()` → 调用 OpenCode SDK `session.create()`
  - `invokeAgent()` → 调用 `session.prompt()` 返回文本
  - 添加流式支持：`invokeAgentStream()` → `session.prompt({ stream: true })` 返回 chunk 回调
  - 复用 `packages/server/src/opencode/manager.ts` 的模式（已验证可用）
- **依赖**：无（SessionManager 已可用）
- **验证**：单元测试 mock SDK；集成测试需 OpenCode Docker 运行

### 1.2 stats.ts 迁移到真实 DB（P1，无依赖）
- **文件**：`packages/server/src/routes/stats.ts`
- **任务**：
  - `GET /` — 从 chapters + projects 表聚合 totalWords/totalChapters
  - `GET /cost` — 从 agentLogs 表聚合 token/cost（无数据时返回零值）
  - `GET /foreshadow` — 从 plotThreads 表读取
  - 删除所有 `demo*()` 函数
- **验证**：路由测试

### 1.3 export.ts 迁移到真实 DB（P1，无依赖）
- **文件**：`packages/server/src/routes/export.ts`
- **任务**：
  - 从 chapters + projects 表读取真实数据
  - 删除 demoStore Map 和 seedDemoChapters
- **验证**：路由测试

---

## Phase 2：写作管道 + 筹备对齐路由

### 2.1 写作管道串联（P1，依赖 Phase 1.1）
- **文件**：`packages/server/src/app.ts` + `packages/server/src/routes/writing.ts`
- **任务**：
  - 在 app.ts 中创建 Bridge 实例，注入到 ChapterPipeline
  - 创建 PipelineProvider 工厂函数
  - writing.ts 的 pipeline 路径串联 WriterEngine → ReviewEngine → ZaishiEngine
  - Pipeline 写作事件通过 EventBus 推送到 SSE
- **验证**：POST /writing/next 返回 202 + SSE 收到 writing 事件

### 2.2 筹备对齐路由（P1，依赖 Phase 1.1）
- **文件**：新增/修改 world.ts、characters.ts、styles.ts、outline.ts
- **任务**：
  - `POST /api/projects/:id/world/align` — 调 JiangxinEngine 世界观对齐
  - `POST /api/projects/:id/characters/align` — 调 JiangxinEngine 角色对齐
  - `POST /api/projects/:id/styles/align` — 调 StyleManager + LLM 文风对齐
  - `POST /api/projects/:id/outline/align` — 调 JiangxinEngine 大纲对齐
  - 响应格式：`{ reply: string, data: StructuredResult | null }`
- **验证**：路由测试

### 2.3 AI POST 端点接引擎（P2，依赖 Phase 1.1）
- **文件**：reviews.ts、diagnosis.ts、reader-review.ts、analysis.ts
- **任务**：
  - reviews POST → ReviewEngine.review()
  - diagnosis POST → DianjingEngine.diagnose()
  - reader-review POST → ShuchongEngine.review()
  - analysis POST → XidianEngine.analyze()（或 DianjingEngine）
  - 删除所有硬编码 mock 生成逻辑
- **验证**：路由测试

---

## Phase 3：DB 适配器

### 3.1 UNM SliceStore DB 适配器（P2，无依赖）
- **文件**：新增 `packages/core/src/unm/drizzle-slice-store.ts`
- **任务**：
  - 实现 SliceStore 接口，对接 memorySlices 表
  - insert / findByCategory / findByTier / compact / count
- **验证**：现有 UNM 测试应全部通过（替换 InMemoryStore）

### 3.2 KnowledgeStore DB 适配器（P2，无依赖）
- **文件**：新增 `packages/core/src/knowledge/drizzle-knowledge-store.ts`
- **任务**：
  - 实现 KnowledgeStore 接口，对接 knowledgeEntries + knowledgeVersions 表
- **验证**：现有 Knowledge 测试应全部通过

---

## Phase 4：前端页面接入

### 4.1 筹备阶段页面（P3，依赖 Phase 2.2）
- **文件**：`packages/web/src/app/projects/[id]/prep/` 下 5 个页面
- **任务**：
  - world/page.tsx — 调用 world align API + 动态渲染世界观文档
  - characters/page.tsx — 调用 characters align API + 动态渲染角色卡
  - style/page.tsx — 调用 styles align API + 动态渲染文风配置
  - outline/page.tsx — 调用 outline align API + 动态渲染大纲
  - ready/page.tsx — 汇总所有筹备状态，显示"开始写作"按钮
  - 所有页面复用 AlignmentLayout + ChatPanel + ResultPanel 组件
  - 对话消息通过各自的 align POST 端点发送
- **验证**：组件测试 + 手动验证

### 4.2 写作面板（P3，依赖 Phase 2.1）
- **文件**：`packages/web/src/app/projects/[id]/write/page.tsx`
- **任务**：
  - 使用已有的 StreamingWriteView + WriteControls + WriteProgress 组件
  - 使用 useStreamingWrite hook 连接 SSE
  - "写下一章"按钮 → POST /writing/next → 订阅 SSE 流式显示
  - 审校结果展示
- **验证**：组件测试

### 4.3 其他面板（P3，依赖 Phase 2.3）
- **文件**：review/manage/analysis/settings/visualize/read 页面
- **任务**：
  - review — 使用 useReviews hook，展示审校报告
  - manage — 章节列表 + 状态管理（使用 useChapters hook）
  - analysis — 使用 useAnalysis hook，展示分析结果
  - settings — 项目设置表单（使用 useProject hook）
  - visualize — 关系图/地点树/时间线（可选：Cytoscape/D3/vis-timeline）
  - read — 章节阅读视图（使用 useChapters hook）
- **验证**：组件测试

---

## Phase 5：测试 + 收尾

### 5.1 全量测试
- 运行 `pnpm test` 确保所有现有 1012 用例通过
- 新增路由测试（stats/export DB 迁移、对齐路由、AI POST 端点）
- 新增组件测试（前端页面）
- 运行 `pnpm typecheck` 确保零错误

### 5.2 文档更新
- 更新 AGENTS.md 中 Bridge 状态为 M1.4 ✅
- 更新里程碑状态表
- 更新 Remaining Tasks 章节

---

## 依赖关系图

```
Phase 1.1 (Bridge) ──┬── Phase 2.1 (写作管道) ── Phase 4.2 (写作UI)
                      ├── Phase 2.2 (对齐路由) ── Phase 4.1 (筹备UI)
                      └── Phase 2.3 (AI POST)  ── Phase 4.3 (其他UI)

Phase 1.2 (stats DB)  ── 独立
Phase 1.3 (export DB)  ── 独立
Phase 3.1 (UNM DB)     ── 独立
Phase 3.2 (Knowledge DB) ── 独立

Phase 5 (测试) ← 所有 Phase 完成
```

---

## 工作量估算

| Phase | 工作量 | 说明 |
|-------|--------|------|
| 1.1 Bridge | 中 | ~200行改动，核心是 SDK 调用模式已验证 |
| 1.2 stats DB | 小 | ~100行，纯 DB 查询 |
| 1.3 export DB | 小 | ~50行，替换数据源 |
| 2.1 写作管道 | 中 | ~200行，串联现有组件 |
| 2.2 对齐路由 | 中 | ~400行，4 个新端点 |
| 2.3 AI POST | 中 | ~300行，4 个端点接引擎 |
| 3.1 UNM DB | 中 | ~200行，实现接口 |
| 3.2 Knowledge DB | 中 | ~150行，实现接口 |
| 4.1 筹备UI | 中 | ~500行，5 个页面 |
| 4.2 写作UI | 中 | ~300行，组件已存在 |
| 4.3 其他UI | 大 | ~1000行，6 个页面 |
| 5 测试 | 大 | 新增测试用例 + 适配 |

**总计**：约 3500 行代码改动/新增

---

## 执行顺序（最优路径）

1. **Phase 1.1 + 1.2 + 1.3 并行** — Bridge + stats + export 无互相依赖
2. **Phase 2.1 + 2.2 + 2.3 + 3.1 + 3.2 并行** — 全部依赖 Bridge 但互不依赖
3. **Phase 4.1 + 4.2 + 4.3** — 依赖对应后端完成
4. **Phase 5** — 收尾
