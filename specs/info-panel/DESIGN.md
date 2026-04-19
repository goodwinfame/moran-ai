# info-panel — DESIGN

> **状态**：已完成
> **模块**：info-panel

## 1. 当前状态

| 组件 | 状态 | V2 改动 |
|------|------|---------|
| 信息面板容器 | ❌ 不存在 | 全新构建 |
| Tab 栏组件 | ❌ 不存在 | 全新构建（8 Tab + 动态可见性 + 徽标 + 自动切换） |
| 8 个 Tab 页组件 | ❌ 不存在 | 全新构建 |
| Panel Zustand Store | ❌ 不存在 | 全新构建 |
| 图表库 | ❌ 不存在 | 新增 Recharts（雷达图 + 趋势折线图） |
| 关系可视化 | ❌ 不存在 | 新增 React Flow（角色关系 + 势力结构 + 世界设定关联） |

## 2. 技术方案

### 2.1 组件结构

```
packages/web/src/components/
├── panel/
│   ├── InfoPanel.tsx              ← 面板容器（Tab 栏 + 内容区 + 空状态）
│   ├── TabBar.tsx                 ← Tab 栏（动态可见性 + 徽标 + 自动切换逻辑）
│   ├── EmptyState.tsx             ← 面板全局空状态引导
│   ├── tabs/
│   │   ├── BrainstormTab.tsx      ← [脑暴] 三阶段折叠
│   │   ├── WorldTab.tsx           ← [设定] 分类标签 + 卡片网格 + 详情页
│   │   ├── WorldDetailPage.tsx    ← [设定] 子系统详情页
│   │   ├── CharacterTab.tsx       ← [角色] 双维度分类 + 四层级展示
│   │   ├── CharacterDetail.tsx    ← [角色] 核心层详情展开
│   │   ├── RelationshipGraph.tsx  ← [角色] 关系网络图（React Flow）
│   │   ├── OutlineTab.tsx         ← [大纲] 三视图切换（大纲/伏笔追踪/时间线）
│   │   ├── ForeshadowView.tsx     ← [大纲] 伏笔追踪视图
│   │   ├── TimelineView.tsx       ← [大纲] 时间线视图
│   │   ├── ChapterTab.tsx         ← [章节] 阅读/写作双模式
│   │   ├── ReviewTab.tsx          ← [审校] 四轮评分 + 问题列表
│   │   ├── AnalysisTab.tsx        ← [分析] 双视图（本项目+参考作品）
│   │   ├── ExternalAnalysisView.tsx ← [分析] 参考作品视图
│   │   └── KnowledgeTab.tsx       ← [知识库] 创作技法（5分类+范围筛选）
│   └── shared/
│       ├── CollapsibleSection.tsx ← 通用折叠区域
│       ├── BadgeIndicator.tsx     ← 红点/数字徽标
│       ├── SearchInput.tsx        ← 搜索输入框（debounce 300ms）
│       └── CardGrid.tsx           ← 响应式卡片网格（双列/单列/紧凑）
├── stores/
│   └── panel-store.ts             ← 面板 Zustand store
```

### 2.2 InfoPanel 容器

```typescript
// InfoPanel.tsx
"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePanelStore } from "@/stores/panel-store";
import { TabBar } from "./TabBar";
import { EmptyState } from "./EmptyState";

// Tab ID → 组件的懒加载映射
const TAB_COMPONENTS: Record<TabId, React.LazyExoticComponent<...>> = {
  brainstorm: lazy(() => import("./tabs/BrainstormTab")),
  world:      lazy(() => import("./tabs/WorldTab")),
  character:  lazy(() => import("./tabs/CharacterTab")),
  outline:    lazy(() => import("./tabs/OutlineTab")),
  chapter:    lazy(() => import("./tabs/ChapterTab")),
  review:     lazy(() => import("./tabs/ReviewTab")),
  analysis:   lazy(() => import("./tabs/AnalysisTab")),
  knowledge:  lazy(() => import("./tabs/KnowledgeTab")),
};

export function InfoPanel({ projectId }: { projectId: string }) {
  const { activeTab, visibleTabs, lastUserActionTime, setLastUserAction } = usePanelStore();
  const panelRef = useRef<HTMLDivElement>(null);

  // 监听用户操作（点击、滚动、选中文字）更新 lastUserActionTime
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const handler = () => setLastUserAction(Date.now());
    el.addEventListener("click", handler);
    el.addEventListener("scroll", handler, true);
    el.addEventListener("selectstart", handler);
    return () => {
      el.removeEventListener("click", handler);
      el.removeEventListener("scroll", handler, true);
      el.removeEventListener("selectstart", handler);
    };
  }, [setLastUserAction]);

  if (visibleTabs.length === 0) {
    return <EmptyState />;
  }

  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <div ref={panelRef} className="flex flex-col h-full">
      <TabBar />
      <div className="flex-1 overflow-y-auto">
        <Suspense fallback={<TabSkeleton />}>
          <ActiveComponent projectId={projectId} />
        </Suspense>
      </div>
    </div>
  );
}
```

### 2.3 Tab 栏 + 自动切换 + 徽标

```typescript
// TabBar.tsx
export type TabId = "brainstorm" | "world" | "character" | "outline"
                  | "chapter" | "review" | "analysis" | "knowledge";

const TAB_LABELS: Record<TabId, string> = {
  brainstorm: "脑暴", world: "设定", character: "角色", outline: "大纲",
  chapter: "章节", review: "审校", analysis: "分析", knowledge: "知识库",
};

export function TabBar() {
  const { activeTab, visibleTabs, badges, setActiveTab, clearBadge } = usePanelStore();

  const handleTabClick = useCallback((tab: TabId) => {
    setActiveTab(tab);
    clearBadge(tab);
  }, [setActiveTab, clearBadge]);

  return (
    <div className="flex items-center gap-6 px-4 border-b bg-background sticky top-0 z-10
                    overflow-x-auto scrollbar-hide">
      {visibleTabs.map((tab) => (
        <button key={tab} onClick={() => handleTabClick(tab)}
          className={cn(
            "relative py-3 text-sm whitespace-nowrap transition-colors",
            activeTab === tab
              ? "text-foreground border-b-2 border-primary font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}>
          {TAB_LABELS[tab]}
          <BadgeIndicator badge={badges[tab]} />
        </button>
      ))}
    </div>
  );
}
```

#### 自动切换逻辑（SSE handler 中调用）

```typescript
// panel-store.ts 中的 action
handleAutoSwitch: (targetTab: TabId) => {
  const state = get();
  const now = Date.now();
  if (now - state.lastUserActionTime < 10_000) {
    // 10 秒保护期 → 仅加红点
    set((s) => ({
      badges: { ...s.badges, [targetTab]: { type: "dot" } },
    }));
  } else {
    set({ activeTab: targetTab });
  }
},
```

#### Tab 可见性管理

```typescript
// 由 SSE 事件驱动，收到某 Tab 域首个数据事件时追加到 visibleTabs
addVisibleTab: (tab: TabId) => {
  set((s) => {
    if (s.visibleTabs.includes(tab)) return s;
    // 保持固定顺序
    const ORDER: TabId[] = ["brainstorm","world","character","outline","chapter","review","analysis","knowledge"];
    const next = [...s.visibleTabs, tab].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    return { visibleTabs: next, activeTab: s.activeTab || tab };
  });
},
```

### 2.4 Zustand Panel Store

```typescript
// packages/web/src/stores/panel-store.ts
import { create } from "zustand";

type BadgeType = { type: "dot" } | { type: "count"; value: number } | { type: "live" };

interface PanelState {
  activeTab: TabId;
  visibleTabs: TabId[];
  badges: Partial<Record<TabId, BadgeType>>;
  lastUserActionTime: number;

  // Tab 数据（每个 Tab 独立 slice）
  brainstorm: BrainstormData | null;
  world: WorldData | null;
  characters: CharacterData | null;
  outline: OutlineData | null;
  foreshadows: ForeshadowData | null;     // 伏笔追踪视图数据
  timeline: TimelineData | null;           // 时间线视图数据
  chapters: ChapterData | null;
  reviews: ReviewData | null;
  analysis: AnalysisData | null;
  externalAnalysis: ExternalAnalysisData | null;  // 参考作品分析
  knowledge: KnowledgeData | null;

  // Actions
  setActiveTab: (tab: TabId) => void;
  addVisibleTab: (tab: TabId) => void;
  handleAutoSwitch: (tab: TabId) => void;
  addBadge: (tab: TabId, badge: BadgeType) => void;
  clearBadge: (tab: TabId) => void;
  setLastUserAction: (time: number) => void;

  // 各 Tab 数据更新 actions
  updateBrainstorm: (patch: Partial<BrainstormData>) => void;
  updateWorld: (patch: WorldPatch) => void;
  updateCharacters: (patch: CharacterPatch) => void;
  updateOutline: (patch: OutlinePatch) => void;
  updateForeshadows: (patch: ForeshadowPatch) => void;
  updateTimeline: (patch: TimelinePatch) => void;
  updateChapter: (patch: ChapterPatch) => void;
  updateReview: (patch: ReviewPatch) => void;
  updateAnalysis: (data: AnalysisData) => void;
  updateExternalAnalysis: (patch: ExternalAnalysisPatch) => void;
  updateKnowledge: (patch: KnowledgePatch) => void;
}
```

### 2.5 [脑暴] Tab 实现

```tsx
// tabs/BrainstormTab.tsx
interface BrainstormData {
  diverge: Array<{ id: string; title: string; starred: boolean }>;
  converge: {
    selectedDirections: string[];
    genre: string;
    coreConflict: string;
    targetAudience: string;
  } | null;
  crystal: {
    title: string;
    type: string;
    concept: string;
    sellingPoints: string;
    wordTarget: string;
    oneLiner: string;
  } | null;
}

export function BrainstormTab({ projectId }: TabProps) {
  const data = usePanelStore((s) => s.brainstorm);
  const sendChat = useChatStore((s) => s.sendMessage);

  if (!data) return <TabEmptyState text="还没有脑暴记录。在左侧告诉墨衡你的创作灵感..." />;

  const handleStar = (direction: string) => {
    sendChat(`我喜欢方向：${direction}`);
  };

  return (
    <div className="p-4 space-y-4">
      <CollapsibleSection title="发散阶段" defaultOpen>
        {data.diverge.map((d) => (
          <div key={d.id} className="flex items-center justify-between py-2">
            <span>{d.title}</span>
            <button onClick={() => handleStar(d.title)}>⭐</button>
          </div>
        ))}
      </CollapsibleSection>
      {data.converge && (
        <CollapsibleSection title="聚焦阶段" defaultOpen>
          {/* 入选方向、题材、核心冲突、目标读者 */}
        </CollapsibleSection>
      )}
      {data.crystal && (
        <CollapsibleSection title="✨ 结晶方案" defaultOpen>
          <CrystalCard data={data.crystal} />
        </CollapsibleSection>
      )}
    </div>
  );
}
```

### 2.6 [设定] Tab 实现

#### 总览视图

```tsx
// tabs/WorldTab.tsx
interface WorldData {
  categories: string[];                     // 动态分类标签
  subsystems: Array<{
    id: string;
    name: string;
    icon: string;
    category: string;
    summary: string;                        // 关键词摘要
    entryCount: number;
    lastUpdatedChapter: number | null;
    hasNewContent: boolean;
  }>;
  activeSubsystemId: string | null;         // 非 null 时显示详情页
}

export function WorldTab({ projectId }: TabProps) {
  const data = usePanelStore((s) => s.world);
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  if (!data) return <TabEmptyState text="世界观设定尚未创建。当脑暴方案确定后..." />;

  if (data.activeSubsystemId) {
    return <WorldDetailPage subsystemId={data.activeSubsystemId} />;
  }

  const filtered = data.subsystems
    .filter((s) => selectedCategories.length === 0 || selectedCategories.includes(s.category))
    .filter((s) => !search || s.name.includes(search) || s.summary.includes(search));

  return (
    <div className="p-4 space-y-4">
      <SearchInput value={search} onChange={setSearch} placeholder="搜索设定内容..." />
      <CategoryChips
        categories={data.categories}
        selected={selectedCategories}
        onChange={setSelectedCategories}
      />
      <CardGrid items={filtered} onCardClick={(id) => setActiveSubsystem(id)} />
    </div>
  );
}
```

#### 响应式卡片网格

```tsx
// shared/CardGrid.tsx
export function CardGrid({ items, onCardClick }: CardGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(500);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const mode = width >= 500 ? "grid-cols-2" : width >= 300 ? "grid-cols-1" : "compact";

  if (mode === "compact") {
    return (
      <div ref={containerRef} className="space-y-1">
        {items.map((item) => (
          <CompactRow key={item.id} item={item} onClick={() => onCardClick(item.id)} />
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("grid gap-4", mode)}>
      {items.map((item) => (
        <SubsystemCard key={item.id} item={item} onClick={() => onCardClick(item.id)} />
      ))}
    </div>
  );
}
```

#### 子系统详情页

```tsx
// tabs/WorldDetailPage.tsx
export function WorldDetailPage({ subsystemId }: { subsystemId: string }) {
  // 从 API 加载详情（sections 数组、关联引用）
  return (
    <div className="p-4">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <button onClick={goBack} className="hover:text-foreground">← 返回设定总览</button>
        <span>›</span>
        <span>{subsystem.icon} {subsystem.name}</span>
      </nav>

      <h2 className="text-lg font-semibold">{subsystem.icon} {subsystem.name}</h2>
      <p className="text-xs text-muted-foreground mt-1">
        最后更新：第 {subsystem.lastUpdatedChapter} 章后 · {subsystem.updatedBy}
      </p>

      <div className="mt-6 space-y-4">
        {subsystem.sections.map((section) => (
          <CollapsibleSection key={section.id} title={section.title}
            badge={`${section.items.length} 条`} defaultOpen>
            <div className="bg-secondary/30 rounded-lg p-4">
              <MarkdownRenderer content={section.content} />
            </div>
          </CollapsibleSection>
        ))}
      </div>

      {subsystem.relations.length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-2">关联：</p>
          {subsystem.relations.map((rel) => (
            <button key={rel.id} onClick={() => navigateTo(rel.id)}
              className="text-sm text-primary hover:underline block">
              → {rel.name}（{rel.reason}）
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 2.7 [角色] Tab 实现

```tsx
// tabs/CharacterTab.tsx
interface CharacterData {
  characters: Character[];
  filterRole: string | null;  // 叙事功能筛选
}

const DESIGN_TIERS = ["核心层", "重要层", "支撑层", "点缀层"] as const;

export function CharacterTab({ projectId }: TabProps) {
  const data = usePanelStore((s) => s.characters);
  const [filterRole, setFilterRole] = useState<string | null>(null);

  if (!data) return <TabEmptyState text="角色档案尚未创建。世界观设定完成后..." />;

  const filtered = filterRole
    ? data.characters.filter((c) => c.role === filterRole)
    : data.characters;

  const grouped = DESIGN_TIERS.map((tier) => ({
    tier,
    characters: filtered.filter((c) => c.designTier === tier),
  })).filter((g) => g.characters.length > 0);

  return (
    <div className="p-4 space-y-4">
      <RoleFilter value={filterRole} onChange={setFilterRole} />
      {grouped.map(({ tier, characters }) => (
        <CollapsibleSection key={tier} title={tier}
          defaultOpen={tier === "核心层" || tier === "重要层"}>
          {tier === "点缀层" ? (
            <MinorCharacterIndex characters={characters} />
          ) : (
            characters.map((c) => (
              <CharacterCard key={c.id} character={c} tier={tier} />
            ))
          )}
        </CollapsibleSection>
      ))}
      {/* 关系网络图 — 仅核心层+重要层角色 */}
      <CollapsibleSection title="角色关系网络" defaultOpen>
        <RelationshipGraph characters={filtered.filter((c) =>
          c.designTier === "核心层" || c.designTier === "重要层"
        )} />
      </CollapsibleSection>
    </div>
  );
}
```

### 2.8 关系可视化 — 技术选型：React Flow

**选型结论**：使用 **React Flow**（`@xyflow/react`）覆盖所有关系图场景。

**选型理由**：

| 维度 | React Flow | D3.js force | Cytoscape.js | G6 |
|------|-----------|-------------|-------------|-----|
| React 集成 | ✅ 原生 React | ❌ 需手动桥接 | ⚠️ 需封装 | ⚠️ 需封装 |
| 节点自定义 | ✅ JSX 节点 | ⚠️ SVG 手绘 | ⚠️ CSS/Canvas | ⚠️ Canvas |
| 交互（拖拽/缩放/平移） | ✅ 内建 | ❌ 需手写 | ✅ 内建 | ✅ 内建 |
| 布局算法 | ⚠️ 需 dagre/elkjs 插件 | ✅ d3-force | ✅ 多种布局 | ✅ 多种布局 |
| 包体积 | ~45KB | ~120KB(d3全) | ~300KB | ~400KB |
| TypeScript | ✅ 原生 | ⚠️ @types | ⚠️ @types | ✅ 原生 |
| SSR 兼容 | ✅ 支持 | ❌ 需 dynamic import | ❌ 需 dynamic import | ❌ 需 dynamic import |

**覆盖场景**：
- 角色关系网络 → 自定义节点（头像 + 姓名 + 层级色），边标注关系类型
- 势力结构图 → 层级布局（dagre），分组节点
- 世界设定关联 → 子系统间交叉引用链接图

```tsx
// tabs/RelationshipGraph.tsx
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const CharacterNode = ({ data }: NodeProps) => (
  <div className="bg-background border rounded-lg p-3 shadow-sm min-w-[120px] text-center">
    <div className="text-2xl">{data.avatar}</div>
    <div className="text-sm font-medium mt-1">{data.name}</div>
    <div className="text-xs text-muted-foreground">{data.role}</div>
  </div>
);

const nodeTypes = { character: CharacterNode };

export function RelationshipGraph({ characters }: { characters: Character[] }) {
  const { nodes, edges } = useMemo(() => buildGraphData(characters), [characters]);

  return (
    <div className="h-[400px] border rounded-lg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

### 2.9 [大纲] Tab 实现

```tsx
// tabs/OutlineTab.tsx
type OutlineView = "outline" | "foreshadow" | "timeline";

interface OutlineData {
  arcs: Array<{
    id: string;
    title: string;
    chapterRange: string;           // "1-30"
    chapters: Array<{
      number: number;
      title: string;
      status: "completed" | "writing" | "reviewing" | "pending" | "unplanned";
      brief: ChapterBrief | null;
    }>;
  }>;
}

interface ForeshadowData {
  unresolved: ForeshadowEntry[];    // 🔴 未解决
  resolved: ForeshadowEntry[];      // ✅ 已回收
  overdue: ForeshadowEntry[];       // ⚠️ 超期
}

interface TimelineData {
  events: Array<{
    id: string;
    storyTime: string;              // 故事内时间点
    description: string;
    characters: string[];
    chapterNumber: number;
  }>;
}

const STATUS_ICONS: Record<string, string> = {
  completed: "✅", writing: "📝", reviewing: "🔄", pending: "⏳", unplanned: "📋",
};

export function OutlineTab({ projectId }: TabProps) {
  const [view, setView] = useState<OutlineView>("outline");
  const outline = usePanelStore((s) => s.outline);
  const foreshadows = usePanelStore((s) => s.foreshadows);
  const timeline = usePanelStore((s) => s.timeline);

  return (
    <div className="flex flex-col h-full">
      {/* 视图切换栏 */}
      <div className="flex gap-4 px-4 py-2 border-b text-sm">
        <button onClick={() => setView("outline")}
          className={cn(view === "outline" && "font-medium text-primary border-b-2 border-primary")}>
          大纲
        </button>
        <button onClick={() => setView("foreshadow")}
          className={cn(view === "foreshadow" && "font-medium text-primary border-b-2 border-primary")}>
          伏笔追踪
        </button>
        <button onClick={() => setView("timeline")}
          className={cn(view === "timeline" && "font-medium text-primary border-b-2 border-primary")}>
          时间线
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {view === "outline" && <OutlineView data={outline} />}
        {view === "foreshadow" && <ForeshadowView data={foreshadows} />}
        {view === "timeline" && <TimelineView data={timeline} />}
      </div>
    </div>
  );
}
```

### 2.10 [章节] Tab 实现

```tsx
// tabs/ChapterTab.tsx
interface ChapterData {
  mode: "reading" | "writing";
  chapterList: Array<{ number: number; title: string; status: string; wordCount: number }>;
  selectedChapter: number | null;
  // 写作模式
  writingProgress: { current: number; target: number } | null;
  streamingContent: string;
  isAutoFollow: boolean;
}

export function ChapterTab({ projectId }: TabProps) {
  const data = usePanelStore((s) => s.chapters);
  if (!data) return <TabEmptyState text="还没有章节内容。大纲完善后，告诉墨衡'开始写第一章'..." />;

  if (data.mode === "writing") {
    return <WritingMode data={data} />;
  }
  return <ReadingMode data={data} projectId={projectId} />;
}

function WritingMode({ data }: { data: ChapterData }) {
  const contentRef = useRef<HTMLDivElement>(null);

  // 自动跟随：默认滚到底部，用户手动滚动后停止
  useEffect(() => {
    if (data.isAutoFollow && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [data.streamingContent, data.isAutoFollow]);

  const progress = data.writingProgress;
  const percent = progress ? Math.round((progress.current / progress.target) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* 进度条 */}
      <div className="px-4 py-2 border-b">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{progress?.current ?? 0} / {progress?.target ?? 0} 字</span>
          <span>{percent}%</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-1.5 mt-1">
          <div className="bg-primary rounded-full h-1.5 transition-all"
            style={{ width: `${percent}%` }} />
        </div>
      </div>
      {/* 流式内容 */}
      <div ref={contentRef} className="flex-1 overflow-y-auto p-4 font-serif leading-relaxed">
        {data.streamingContent}
        <span className="animate-pulse">█</span>
      </div>
      {/* 回到最新按钮 */}
      {!data.isAutoFollow && (
        <button onClick={resumeAutoFollow}
          className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm shadow">
          ↓ 回到最新
        </button>
      )}
    </div>
  );
}
```

### 2.11 [审校] Tab 实现

```tsx
// tabs/ReviewTab.tsx
interface ReviewData {
  chapters: Array<{
    chapterNumber: number;
    title: string;
    reviews: Array<{
      id: string;
      conclusion: "pass" | "revise" | "rewrite";
      totalScore: number;
      rounds: Array<{
        round: 1 | 2 | 3 | 4;
        dimension: string;
        score: number;
        issues: Array<{
          location: string;
          description: string;
          suggestion: string;
          severity: "critical" | "warning";
        }>;
      }>;
    }>;
  }>;
  selectedChapter: number | null;
}

const CONCLUSION_ICONS = { pass: "✅", revise: "⚠️", rewrite: "❌" };
const SEVERITY_COLORS = { critical: "text-destructive", warning: "text-yellow-600" };
```

### 2.12 [分析] Tab 实现 — 图表库选型：Recharts

**选型结论**：使用 **Recharts** 实现雷达图和趋势折线图。

**选型理由**：
- 基于 React 组件化 API，与 Next.js 无缝集成
- 内建 RadarChart 和 LineChart 组件
- 轻量（tree-shakable），仅引入使用的图表类型
- 声明式配置，符合 React 范式
- 响应式 ResponsiveContainer

```tsx
// tabs/AnalysisTab.tsx
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";

type AnalysisView = "internal" | "external";

const NINE_DIMENSIONS = [
  "情节张力", "角色塑造", "对话质量", "描写质量", "原创性",
  "主题呼应", "伏笔管理", "氛围营造", "节奏控制",
];

interface ExternalAnalysisData {
  reports: Array<{
    id: string;
    workTitle: string;
    topic: string;
    date: string;
    content: string;            // Markdown 完整分析报告
  }>;
}

export function AnalysisTab({ projectId }: TabProps) {
  const [view, setView] = useState<AnalysisView>("internal");
  const data = usePanelStore((s) => s.analysis);
  const external = usePanelStore((s) => s.externalAnalysis);

  if (!data && !external) return <TabEmptyState text="还没有分析数据。章节归档后..." />;

  return (
    <div className="flex flex-col h-full">
      {/* 视图切换栏 */}
      <div className="flex gap-4 px-4 py-2 border-b text-sm">
        <button onClick={() => setView("internal")}
          className={cn(view === "internal" && "font-medium text-primary border-b-2 border-primary")}>
          本项目分析
        </button>
        <button onClick={() => setView("external")}
          className={cn(view === "external" && "font-medium text-primary border-b-2 border-primary")}>
          参考作品
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {view === "internal" && data && <InternalAnalysisView data={data} />}
        {view === "external" && <ExternalAnalysisView data={external} />}
      </div>
    </div>
  );
}

function InternalAnalysisView({ data }: { data: AnalysisData }) {
  return (
    <div className="p-4 space-y-6">
      {/* 九维雷达图 */}
      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data.radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12 }} />
            <PolarRadiusAxis domain={[0, 100]} />
            <Radar dataKey="score" stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))" fillOpacity={0.3} />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* 趋势折线图 */}
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="chapter" label={{ value: "章节", position: "insideBottom" }} />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            {NINE_DIMENSIONS.map((dim, i) => (
              <Line key={dim} type="monotone" dataKey={dim}
                stroke={COLORS[i]} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 详细评语 */}
      <CollapsibleSection title="析典详细评语" defaultOpen={false}>
        <MarkdownRenderer content={data.commentary} />
      </CollapsibleSection>
    </div>
  );
}
```

### 2.13 [知识库] Tab 实现

```tsx
// tabs/KnowledgeTab.tsx
interface KnowledgeData {
  entries: KnowledgeEntry[];
  totalCount: number;
  loadedCount: number;
}

type KnowledgeScope = "project" | "global";

const CATEGORY_FILTERS = [
  { value: "all", label: "全部" },
  { value: "writing_craft", label: "写作技巧" },
  { value: "genre", label: "题材知识" },
  { value: "style", label: "风格专项" },
  { value: "lesson", label: "经验教训" },
  { value: "analysis", label: "析典沉淀" },
];

export function KnowledgeTab({ projectId }: TabProps) {
  const data = usePanelStore((s) => s.knowledge);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<string[]>(["all"]);
  const [scope, setScope] = useState<KnowledgeScope>("project");

  if (!data) return <TabEmptyState text="知识库暂无条目。随着创作推进，写作技巧和经验教训会在这里积累..." />;

  return (
    <div className="p-4 space-y-4">
      <SearchInput value={search} onChange={setSearch} placeholder="搜索知识库..." />
      {/* 范围切换 */}
      <div className="flex gap-2">
        <button onClick={() => setScope("project")}
          className={cn("px-3 py-1 text-xs rounded-full border",
            scope === "project" && "bg-primary text-primary-foreground")}>
          当前项目
        </button>
        <button onClick={() => setScope("global")}
          className={cn("px-3 py-1 text-xs rounded-full border",
            scope === "global" && "bg-primary text-primary-foreground")}>
          全局
        </button>
      </div>
      {/* 分类筛选 */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map((cat) => (
          <FilterChip key={cat.value} label={cat.label}
            active={categories.includes(cat.value)}
            onClick={() => toggleCategory(cat.value)} />
        ))}
      </div>
      {/* 条目列表 */}
      <div className="space-y-2">
        {filteredEntries.map((entry) => (
          <KnowledgeCard key={entry.id} entry={entry}
            onPromote={entry.scope === "project" ? () => promoteToGlobal(entry.id) : undefined} />
        ))}
      </div>
      {data.loadedCount < data.totalCount && (
        <button onClick={loadMore} className="w-full py-2 text-sm text-muted-foreground
          hover:text-foreground border rounded-lg">
          加载更多 ▼（{data.totalCount - data.loadedCount} 条）
        </button>
      )}
    </div>
  );
}
```

### 2.14 SSE 事件 → Panel Store 映射

SSE 事件在 `sse-handler.ts`（sse-realtime 模块）中分发，info-panel 注册以下 handlers：

| SSE 事件 | Panel Store Action | 附加行为 |
|----------|-------------------|---------|
| `brainstorm.diverge` | `updateBrainstorm({ diverge: [...] })` | `addVisibleTab("brainstorm")` |
| `brainstorm.converge` | `updateBrainstorm({ converge: ... })` | — |
| `brainstorm.crystallize` | `updateBrainstorm({ crystal: ... })` | `handleAutoSwitch("brainstorm")` |
| `world.created` | `updateWorld({ subsystems: [...] })` | `addVisibleTab("world")` |
| `world.subsystem_created` | `updateWorld({ addSubsystem: ... })` | `addBadge("world", { type: "dot" })` |
| `world.subsystem_updated` | `updateWorld({ patchSubsystem: ... })` | `addBadge("world", { type: "dot" })` |
| `character.created` | `updateCharacters({ add: ... })` | `addVisibleTab("character")` |
| `character.updated` | `updateCharacters({ patch: ... })` | `addBadge("character", { type: "dot" })` |
| `outline.arc_created` | `updateOutline({ addArc: ... })` | `addVisibleTab("outline")` |
| `outline.brief_created` | `updateOutline({ addBrief: ... })` | `addBadge("outline", { type: "dot" })` |
| `outline.foreshadow_added` | `updateForeshadows({ add: ... })` | `addBadge("outline", { type: "dot" })` |
| `outline.foreshadow_resolved` | `updateForeshadows({ resolve: ... })` | `addBadge("outline", { type: "dot" })` |
| `outline.timeline_updated` | `updateTimeline({ events: ... })` | `addBadge("outline", { type: "dot" })` |
| `chapter.start` | `updateChapter({ mode: "writing" })` | `addBadge("chapter", { type: "live" })` |
| `chapter.token` | `updateChapter({ appendContent })` | — |
| `chapter.complete` | `updateChapter({ mode: "reading" })` | `clearBadge("chapter")` |
| `review.complete` | `updateReview({ addReview: ... })` | `addBadge("review", { type: "count" })` |
| `analysis.complete` | `updateAnalysis(data)` | `handleAutoSwitch("analysis")` |
| `analysis.external_complete` | `updateExternalAnalysis({ add: ... })` | `addBadge("analysis", { type: "dot" })` |
| `knowledge.entry_added` | `updateKnowledge({ add: ... })` | `addBadge("knowledge", { type: "dot" })` |
| `knowledge.promoted` | `updateKnowledge({ promote: ... })` | `addBadge("knowledge", { type: "dot" })` |

### 2.15 IndexedDB 离线缓存

使用 `idb-keyval` 轻量库对面板数据进行本地持久化：

```typescript
// 在 panel-store.ts 中集成
import { get as idbGet, set as idbSet } from "idb-keyval";

// 初始化时从 IndexedDB 恢复
const initPanelData = async (projectId: string) => {
  const cached = await idbGet(`panel:${projectId}`);
  if (cached) usePanelStore.setState(cached);
};

// 数据变更时写入 IndexedDB（debounce 1s）
const persistToIDB = debounce((projectId: string, state: PanelState) => {
  const { activeTab, visibleTabs, brainstorm, world, characters, outline, foreshadows, timeline, chapters, reviews, analysis, externalAnalysis, knowledge } = state;
  idbSet(`panel:${projectId}`, { activeTab, visibleTabs, brainstorm, world, characters, outline, foreshadows, timeline, chapters, reviews, analysis, externalAnalysis, knowledge });
}, 1000);

usePanelStore.subscribe((state) => persistToIDB(currentProjectId, state));
```

### 2.16 新增依赖

| 包 | 用途 | 安装位置 |
|----|------|---------|
| `recharts` | 雷达图 + 趋势折线图 | web |
| `@xyflow/react` | 关系可视化（角色关系/势力/设定关联） | web |
| `idb-keyval` | IndexedDB 离线缓存（轻量 KV 封装） | web |

## 3. 不需要改动的部分

- `components/ui/` shadcn 组件（直接复用）
- `lib/api.ts` API client（面板通过 API + SSE 获取数据）
- `stores/chat-store.ts`（聊天 store 独立，脑暴 Tab 的 sendMessage 通过跨 store 引用）
- `layout.tsx` 根 Layout
- `globals.css` Tailwind 入口

## 4. 风险与注意事项

- **React Flow SSR**：需通过 `next/dynamic` + `ssr: false` 加载，避免 window undefined 错误
- **Recharts SSR**：同理需 dynamic import，Recharts 依赖浏览器 API
- **面板宽度监听**：使用 ResizeObserver 而非 window resize，因为面板宽度受分隔条拖拽控制，非窗口大小
- **IndexedDB 容量**：单项目缓存控制在 5MB 以内，超过时清理最旧的章节内容
- **Tab 切换性能**：使用 `React.lazy` + `Suspense` 懒加载各 Tab 组件，避免一次性加载全部
- **流式写作渲染**：`chapter.token` 事件高频到达，需 `requestAnimationFrame` 节流合并，避免每 token 触发 re-render
- **自动跟随逻辑**：用户手动向上滚动后需精确检测并停止自动跟随，IntersectionObserver 监听底部哨兵元素
