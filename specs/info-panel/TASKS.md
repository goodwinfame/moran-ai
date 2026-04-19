# info-panel — TASKS

> **模块**：info-panel

## 任务列表

### T1: 创建组件目录结构 + Panel Store 骨架
- **输出**：
  - `components/panel/` 目录
  - `components/panel/tabs/` 目录
  - `components/panel/shared/` 目录
  - `stores/panel-store.ts`（TabId 类型、state 结构、基础 actions）
- **验收**：目录结构存在，`pnpm typecheck` 通过

### T2: 实现 InfoPanel 容器 + TabBar + EmptyState
- **依赖**：T1
- **输出**：
  - `components/panel/InfoPanel.tsx`（面板容器，用户操作监听，懒加载 Tab 组件）
  - `components/panel/TabBar.tsx`（8 Tab 渲染 + 动态可见性 + 下划线高亮）
  - `components/panel/EmptyState.tsx`（全局空状态引导）
  - `components/panel/shared/BadgeIndicator.tsx`（红点/数字/实时徽标）
- **规则**：
  - Tab 栏固定面板顶部，不随内容滚动
  - Tab 名 14px 字体，间距 24px
  - 自动切换 + 10 秒保护逻辑在 panel-store action 中
  - Tab 可见性按固定顺序（脑暴→设定→角色→大纲→章节→审校→分析→知识库）
  - 点击 Tab 时清除该 Tab 徽标
- **验收**：空状态正确渲染，手动设置 visibleTabs 后 Tab 栏正确显示

### T3: 实现通用共享组件
- **依赖**：T1
- **输出**：
  - `components/panel/shared/CollapsibleSection.tsx`（折叠区域，支持 defaultOpen + badge）
  - `components/panel/shared/SearchInput.tsx`（debounce 300ms 搜索框）
  - `components/panel/shared/CardGrid.tsx`（ResizeObserver 响应式：≥500px 双列 / 300-499px 单列 / <300px 紧凑列表）
  - 各 Tab 的 `TabEmptyState` 组件（复用模式：文字 + 图标）
- **验收**：各组件独立可渲染，CardGrid 响应面板宽度变化

### T4: 实现 [脑暴] Tab
- **依赖**：T2, T3
- **输出**：`components/panel/tabs/BrainstormTab.tsx`
- **规则**：
  - 三阶段折叠（发散/聚焦/结晶）
  - ⭐ 星标点击调用 chat-store `sendMessage("我喜欢方向 X")`
  - 结晶方案以卡片形式突出展示
  - 空状态文案
- **验收**：mock 数据下三阶段正确渲染，星标点击触发 sendMessage

### T5: 实现 [设定] Tab（总览 + 详情页）
- **依赖**：T2, T3
- **输出**：
  - `components/panel/tabs/WorldTab.tsx`（总览：搜索 + 分类标签 + 卡片网格）
  - `components/panel/tabs/WorldDetailPage.tsx`（子系统详情：面包屑 + 折叠段落 + 关联引用）
- **规则**：
  - 搜索框实时过滤（debounce 300ms），关键词高亮
  - 分类标签由数据驱动，不硬编码，溢出时 [+N]
  - 卡片网格响应面板宽度（CardGrid 组件）
  - 点击卡片 → 详情页（Tab 内切换，非路由跳转）
  - 面包屑导航 `← 返回设定总览 › 子系统名`
  - 详情页段落可折叠，默认全展开
  - 关联引用点击跳转到其他子系统
- **验收**：总览卡片 + 搜索 + 分类筛选 + 详情页导航 全部可用

### T6: 实现 [角色] Tab + 角色详情
- **依赖**：T2, T3
- **输出**：
  - `components/panel/tabs/CharacterTab.tsx`（双维度分类 + 四层级展示）
  - `components/panel/tabs/CharacterDetail.tsx`（核心层详情展开：五维心理模型）
- **规则**：
  - 叙事功能筛选器（主角/第二主角/对手/配角/次要）
  - 按设计深度分组展示（核心层/重要层默认展开，支撑层/点缀层折叠）
  - 核心层展开显示完整五维 GHOST→WOUND→LIE→WANT↔NEED
  - 重要层简要：性格+目标+关系+弧光
  - 点缀层折叠为索引列表（姓名+一句话）
- **验收**：筛选 + 分组 + 四种层级卡片正确渲染

### T7: 安装 React Flow + 实现关系可视化
- **依赖**：T6
- **输出**：
  - 安装 `@xyflow/react`
  - `components/panel/tabs/RelationshipGraph.tsx`（角色关系网络图）
- **规则**：
  - 自定义 CharacterNode（头像+姓名+层级色）
  - 边标注关系类型
  - 节点可拖拽、悬停高亮关联边、点击跳转角色卡片
  - 支持缩放平移（Controls + MiniMap）
  - 仅渲染核心层+重要层角色
  - `next/dynamic` + `ssr: false` 加载
- **验收**：关系图可交互，拖拽/缩放/悬停/点击正常

### T8: 实现 [大纲] Tab
- **依赖**：T2, T3
- **输出**：`components/panel/tabs/OutlineTab.tsx`
- **规则**：
  - 弧段→章节两级树形，弧段可折叠
  - 章节节点点击展开 Brief 详情
  - 5 种状态图标（✅📝🔄⏳📋）
- **验收**：树形结构正确，状态图标匹配

### T9: 实现 [章节] Tab（阅读+写作双模式）
- **依赖**：T2, T3
- **输出**：`components/panel/tabs/ChapterTab.tsx`
- **规则**：
  - **阅读模式**：章节列表侧栏 + 元数据栏 + 正文只读展示
  - **写作模式**：进度条（已写/目标+%）+ 流式逐字渲染 + 光标闪烁 `█`
  - 自动跟随：默认跟随，用户手动向上滚动后停止，底部出现 [↓ 回到最新]
  - 写作完成后自动切回阅读模式
  - `chapter.token` 高频事件需 RAF 节流
- **验收**：双模式切换正确，流式渲染平滑

### T10: 实现 [审校] Tab
- **依赖**：T2, T3
- **输出**：`components/panel/tabs/ReviewTab.tsx`
- **规则**：
  - 章节选择下拉
  - 综合评分卡片（总分 + 结论 ✅/⚠️/❌ + 四轮评分条）
  - 四轮详情折叠区域（展开显示问题列表：位置/描述/建议/严重程度🔴🟡）
  - 历史记录各轮次对比
- **验收**：评分 + 问题列表 + 结论逻辑正确渲染

### T11: 安装 Recharts + 实现 [分析] Tab
- **依赖**：T2, T3
- **输出**：
  - 安装 `recharts`
  - `components/panel/tabs/AnalysisTab.tsx`
- **规则**：
  - 九维雷达图：RadarChart，中心标综合分，Tooltip 悬停显示分数
  - 趋势折线图：LineChart，X 轴章节序号，Y 轴 0-100，9 条折线 + 图例切换
  - 详细评语：折叠的 Markdown 内容
  - `next/dynamic` + `ssr: false` 加载
- **验收**：雷达图 + 折线图正确渲染，Tooltip 和图例交互正常

### T12: 实现 [知识库] Tab
- **依赖**：T2, T3
- **输出**：`components/panel/tabs/KnowledgeTab.tsx`
- **规则**：
  - 搜索框实时过滤（debounce 300ms）
  - 分类多选筛选按钮：全部/角色/世界/术语/教训
  - 条目卡片列表（图标+分类+标题+摘要+来源），点击展开完整内容
  - 分页：每页 20 条，[加载更多 ▼]
- **验收**：搜索 + 分类筛选 + 展开 + 分页全部可用

### T13: Panel Store 完整实现 + SSE Handler 集成
- **依赖**：T4-T12
- **输出**：
  - `stores/panel-store.ts` 完整实现（所有 Tab 数据 slice + actions）
  - SSE 事件 → panel-store action 映射（在 sse-handler 中注册）
  - 自动切换 + 10 秒保护 + 徽标管理
- **验收**：
  - 模拟 SSE 事件 → store 状态正确更新
  - 自动切换保护期逻辑测试
  - Tab 可见性随事件动态变化

### T14: IndexedDB 离线缓存集成
- **依赖**：T13
- **输出**：
  - 安装 `idb-keyval`
  - panel-store 集成：初始化时恢复、变更时 debounce 写入
- **验收**：刷新页面后面板数据从 IndexedDB 恢复

### T15: 验证全局构建
- **依赖**：T1-T14
- **输出**：`pnpm typecheck` + `pnpm test` 全部通过
- **验收**：零错误

## 依赖关系

```
T1 ──→ T2 ──→ T4
 │      │      T5
 │      │      T6 ──→ T7
 │      │      T8
 │      │      T9
 │      │      T10
 │      │      T11
 │      │      T12
 │      │      └──→ T13 ──→ T14 ──→ T15
 └──→ T3 ──→ (T4-T12 共用)
```

T1 创建结构。T2 面板容器+Tab 栏。T3 共享组件。T4-T12 各 Tab 可并行开发。T7/T11 需安装新依赖。T13 集成 store + SSE。T14 离线缓存。T15 最终验证。

**跨模块依赖**：
- InfoPanel 被 chat-ui 的 WorkspacePage 引用（作为右侧面板）
- SSE 事件来自 sse-realtime 模块
- 脑暴 Tab 的 sendMessage 引用 chat-store（跨 store 调用）
- 所有 Tab 数据通过 api-routes 模块的面板端点初始加载
