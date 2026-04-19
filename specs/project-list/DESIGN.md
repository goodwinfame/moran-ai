# project-list — DESIGN

> **状态**：已完成
> **模块**：project-list

## 1. 当前状态

| 组件 | 状态 | V2 改动 |
|------|------|---------|
| `app/page.tsx` | ✅ V2 骨架 | 需完整重写为项目列表页 |
| `components/ui/` | ✅ 10 个 shadcn 组件 | 复用，按需增加 |
| `lib/api.ts` | ✅ API client | 复用 |
| `lib/utils.ts` | ✅ cn() 工具 | 复用 |

## 2. 技术方案

### 2.1 路由结构

```
packages/web/src/app/
├── layout.tsx                    ← 根 Layout（字体、全局 CSS）
├── page.tsx                      ← 项目列表页（"/"）
├── projects/
│   └── [id]/
│       └── page.tsx              ← 主工作页（"/projects/:id"）
└── globals.css                   ← Tailwind CSS v4 入口
```

`/projects` 路由通过 Next.js 重定向到 `/`（项目列表和根路径共享同一页面）。

### 2.2 组件结构

```
packages/web/src/components/
├── ui/                           ← shadcn 组件（已有）
├── project-list/
│   ├── ProjectListPage.tsx       ← 页面主组件
│   ├── ProjectCard.tsx           ← 项目卡片
│   ├── ProjectCardMenu.tsx       ← 右键操作菜单
│   ├── EmptyState.tsx            ← 空状态引导
│   ├── InlineChatInput.tsx       ← 底部聊天输入框
│   ├── InlineChatBubble.tsx      ← 内联回复气泡
│   └── UserMenu.tsx              ← 右上角用户菜单
└── shared/
    ├── ConfirmDialog.tsx         ← 通用确认对话框
    └── InlineEditor.tsx          ← 内联编辑组件（重命名复用）
```

### 2.3 状态管理

```typescript
// packages/web/src/stores/project-list-store.ts
import { create } from "zustand";

interface ProjectItem {
  id: string;
  title: string;
  genre: string;
  status: "brainstorm" | "world" | "character" | "outline" | "writing" | "completed";
  currentChapter: number;
  chapterCount: number;
  totalWordCount: number;
  updatedAt: string;
  isPinned: boolean;
}

interface ProjectListState {
  projects: ProjectItem[];
  isLoading: boolean;
  inlineMessages: Array<{ role: "user" | "assistant"; content: string }>;

  // Actions
  fetchProjects: () => Promise<void>;
  createProject: (title: string, genre?: string) => Promise<string>;
  deleteProject: (id: string) => Promise<void>;
  renameProject: (id: string, title: string) => Promise<void>;
  pinProject: (id: string) => Promise<void>;
  archiveProject: (id: string) => Promise<void>;
  sendInlineMessage: (message: string) => Promise<void>;
  clearInlineMessages: () => void;
}
```

### 2.4 API 调用

所有数据通过 `lib/api.ts` 调用 Hono 后端：

```typescript
// 项目列表
const projects = await api.get("/api/projects");
// 创建项目
const newProject = await api.post("/api/projects", { title, genre });
// 发送消息（列表页轻量对话）
const reply = await api.post("/api/chat/send", { projectId: null, message });
```

列表页的墨衡对话使用全局 session（projectId 为 null），不绑定具体项目。

### 2.5 页面布局实现

```tsx
// ProjectListPage.tsx 布局
<div className="flex flex-col h-screen">
  {/* 顶部：品牌 + 用户头像 */}
  <header className="flex items-center justify-between px-6 py-4 border-b">
    <span className="text-xl font-bold font-serif">墨染 MoRan</span>
    <UserMenu />
  </header>

  {/* 中部：项目卡片区 */}
  <main className="flex-1 overflow-y-auto p-6">
    {projects.length === 0 ? <EmptyState /> : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedProjects.map((p) => <ProjectCard key={p.id} project={p} />)}
      </div>
    )}
  </main>

  {/* 底部：内联回复气泡 + 输入框 */}
  <div className="border-t px-6 py-4">
    {inlineMessages.map((msg, i) => <InlineChatBubble key={i} {...msg} />)}
    <InlineChatInput onSend={handleSend} />
  </div>
</div>
```

### 2.6 项目卡片设计

```tsx
// ProjectCard.tsx
<div
  className="border rounded-xl p-4 hover:shadow-md transition cursor-pointer group"
  onClick={() => router.push(`/projects/${project.id}`)}
  onContextMenu={handleContextMenu}
>
  <div className="flex items-start justify-between">
    <h3 className="font-semibold text-lg">{project.title}</h3>
    {project.isPinned && <span className="text-xs">📌</span>}
  </div>
  <p className="text-sm text-muted-foreground mt-1">{project.genre}</p>
  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
    <span>{stageLabel(project.status)}</span>
    <span>{project.currentChapter}/{project.chapterCount} 章</span>
    <span>{formatWordCount(project.totalWordCount)}</span>
    <span className="ml-auto">{relativeTime(project.updatedAt)}</span>
  </div>
</div>
```

### 2.7 意图路由

列表页的意图路由由墨衡在服务端完成——前端只发送消息，接收墨衡回复。
墨衡回复中可能携带 action 指令：

```typescript
interface InlineReply {
  text: string;
  action?: {
    type: "navigate" | "create_project";
    projectId?: string;
    title?: string;
  };
}
```

**前端响应解析逻辑**：

```typescript
async function handleInlineReply(reply: InlineReply) {
  // 1. 始终显示文本回复
  addInlineMessage({ role: "assistant", content: reply.text });

  // 2. 如果携带 action，执行对应操作
  if (!reply.action) return;

  switch (reply.action.type) {
    case "navigate":
      router.push(`/projects/${reply.action.projectId}`);
      break;
    case "create_project":
      // 创建项目后跳转
      const newId = await projectStore.createProject(
        reply.action.title ?? "未命名项目"
      );
      router.push(`/projects/${newId}`);
      break;
  }
}
```

**错误处理**：

| 错误场景 | 前端行为 |
|----------|----------|
| 网络请求失败 | 显示 "网络异常，请重试" 内联消息，输入框保持可用 |
| SSE 连接断开 | 内联消息区显示断线提示，自动重连后恢复 |
| `navigate` 目标项目不存在 | 跳转后由项目页处理 404 |
| `create_project` 失败 | 显示 "创建失败：{error.message}" 内联消息 |
| 墨衡回复超时（>10s） | 显示 "思考中…" 加载动画，30s 后提示超时 |

**加载状态**：

```typescript
// InlineChatInput 发送消息后的状态流转
idle → sending（禁用输入框 + 显示加载动画）→ streaming（逐字显示回复）→ idle
```

- 发送消息后输入框禁用，显示 "墨衡思考中…" 占位
- 收到首个 token 后切换为流式显示
- 回复完成或出错后恢复输入框

### 2.8 阶段标签映射

```typescript
const STAGE_LABELS: Record<string, string> = {
  brainstorm: "🧠 脑暴中",
  world: "🌍 设定中",
  character: "👥 塑角中",
  outline: "📋 谋篇中",
  writing: "✍️ 写作中",
  completed: "✅ 已完结",
};
```

## 3. 不需要改动的部分

- `layout.tsx` 根 Layout（字体+全局 CSS 已就绪）
- `components/ui/` shadcn 组件
- `lib/api.ts` API client
- `lib/utils.ts` 工具函数
- `globals.css` Tailwind 入口

## 4. 风险与注意事项

- **列表页 SSE**：列表页的墨衡对话需要轻量 SSE 连接（全局 session），与项目级 SSE 不同
- **内联回复最多 3 轮**：需前端控制，超过 3 轮自动裁剪最早的
- **意图路由延迟**：墨衡识别意图可能需要 1-2 秒，需要加载状态
