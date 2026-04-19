# chat-ui — DESIGN

> **状态**：已完成
> **模块**：chat-ui

## 1. 当前状态

| 组件 | 状态 | V2 改动 |
|------|------|---------|
| `app/projects/[id]/page.tsx` | ❌ 不存在 | 全新构建 |
| 聊天组件 | ❌ 不存在 | 全新构建 |
| 分隔条组件 | ❌ 不存在 | 全新构建 |

## 2. 技术方案

### 2.1 组件结构

```
packages/web/src/components/
├── workspace/
│   ├── WorkspacePage.tsx         ← 主工作页容器（分栏 + 分隔条）
│   ├── ResizableSplitter.tsx     ← 可拖拽分隔条
│   └── MobileTabBar.tsx          ← < 768px Tab 切换栏
├── chat/
│   ├── ChatPanel.tsx             ← 聊天面板容器（导航栏 + 消息流 + 状态条 + 输入区 + 快捷栏）
│   ├── ChatNavBar.tsx            ← 顶部导航栏
│   ├── MessageList.tsx           ← 消息流列表
│   ├── MessageBubble.tsx         ← 单条消息气泡（5 种类型）
│   ├── ChatInput.tsx             ← 输入区（多行 + 发送 + 附件 + 快捷命令）
│   ├── QuestionPanel.tsx         ← 决策选项面板（替换输入框）
│   ├── CommandPalette.tsx        ← `/` 快捷命令面板
│   ├── AgentStatusBar.tsx        ← Agent 工作状态条
│   ├── AgentDrawer.tsx           ← Agent 会话抽屉
│   ├── QuickActions.tsx          ← 底部快捷操作栏
│   ├── MarkdownRenderer.tsx      ← Markdown 富文本渲染
│   └── FileUploadDialog.tsx      ← 文件上传弹窗
├── settings/
│   ├── ProjectSettingsDrawer.tsx ← 项目设置抽屉（400px）
│   ├── ExportDialog.tsx          ← 导出对话框
│   └── TokenReportModal.tsx      ← Token 详细报表 Modal
```

### 2.2 分栏布局实现

```typescript
// WorkspacePage.tsx
"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export function WorkspacePage({ projectId }: { projectId: string }) {
  const [splitRatio, setSplitRatio] = useState(() => {
    // 从 localStorage 恢复
    const saved = localStorage.getItem(`split-ratio:${projectId}`);
    return saved ? parseFloat(saved) : getDefaultRatio();
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  function getDefaultRatio(): number {
    const width = window.innerWidth;
    if (width >= 1440) return 0.4;
    if (width >= 1024) return 0.45;
    return 0.5;
  }

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let ratio = (e.clientX - rect.left) / rect.width;
    ratio = Math.max(0.25, Math.min(0.70, ratio)); // 左25%~70%, 右30%~75%
    setSplitRatio(ratio);
  }, []);

  const handleDoubleClick = useCallback(() => {
    setSplitRatio(getDefaultRatio());
  }, []);

  // 持久化
  useEffect(() => {
    localStorage.setItem(`split-ratio:${projectId}`, String(splitRatio));
  }, [splitRatio, projectId]);

  const isMobile = useWindowWidth() < 768;

  if (isMobile) {
    return <MobileTabLayout projectId={projectId} />;
  }

  return (
    <div ref={containerRef} className="flex h-screen">
      <div style={{ width: `${splitRatio * 100}%` }}>
        <ChatPanel projectId={projectId} />
      </div>
      <ResizableSplitter
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      />
      <div style={{ width: `${(1 - splitRatio) * 100}%` }}>
        <InfoPanel projectId={projectId} />
      </div>
    </div>
  );
}
```

### 2.3 分隔条组件

```tsx
// ResizableSplitter.tsx
export function ResizableSplitter({ onMouseDown, onDoubleClick }: Props) {
  return (
    <div
      className="w-1 hover:w-2 bg-border hover:bg-primary/20 cursor-col-resize
                 transition-all duration-150 flex-shrink-0"
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    />
  );
}
```

### 2.4 消息类型渲染

```typescript
// MessageBubble.tsx
type MessageType = "user" | "assistant" | "system" | "progress" | "decision";

interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  metadata?: {
    interaction_mode?: "question";
    options?: Array<{ label: string; value: string }>;
    agentName?: string;
    inlineActions?: Array<{ label: string; action: string }>;
  };
  timestamp: number;
}
```

渲染策略：
| 类型 | 对齐 | 背景 | 特殊渲染 |
|------|------|------|---------|
| user | 右对齐 | 浅色(bg-secondary) | 纯文本 |
| assistant | 左对齐 | 白色(bg-background) | Markdown + 内联按钮 |
| system | 居中 | 无背景 | 小字灰色 |
| progress | 左对齐 | 无背景 | 动画进度条 |
| decision | — | — | 触发 QuestionPanel |

### 2.5 流式打字机效果

```typescript
// 使用 SSE text 事件驱动
// stores/chat-store.ts
interface ChatState {
  messages: ChatMessage[];
  streamingText: string;  // 当前正在流式输出的文本
  isStreaming: boolean;

  appendStreamText: (chunk: string) => void;
  finalizeStream: () => void;
}

// MessageList 中对最后一条消息使用 streamingText 渲染
// 使用 requestAnimationFrame 节流避免过度渲染
```

### 2.6 Question Panel 实现

```tsx
// QuestionPanel.tsx
interface QuestionPanelProps {
  question: string;
  options: Array<{ label: string; value: string }>;
  onSelect: (value: string) => void;
  onFreeInput: () => void;
}

export function QuestionPanel({ question, options, onSelect, onFreeInput }: QuestionPanelProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < options.length) onSelect(options[idx].value);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [options, onSelect]);

  return (
    <div className="border-t p-4 space-y-2">
      <p className="text-sm text-muted-foreground">{question}</p>
      {options.map((opt, i) => (
        <button key={i} onClick={() => onSelect(opt.value)}
          className="w-full text-left px-4 py-3 border rounded-lg hover:bg-secondary transition">
          <span className="text-muted-foreground mr-2">{i + 1}.</span>
          {opt.label}
        </button>
      ))}
      <button onClick={onFreeInput}
        className="w-full text-left px-4 py-3 border rounded-lg hover:bg-secondary text-muted-foreground">
        💬 自由输入
      </button>
    </div>
  );
}
```

### 2.7 Agent 状态条实现

```tsx
// AgentStatusBar.tsx
export function AgentStatusBar() {
  const agents = useAgentStore((s) => Array.from(s.agents.values()));
  const visibleAgents = agents.slice(0, 2);
  const overflow = agents.length - 2;

  if (agents.length === 0) return null;

  return (
    <div className="px-4 py-2 border-t animate-slideIn">
      {visibleAgents.map((agent) => (
        <AgentStatusRow key={agent.agentId} agent={agent}
          onClick={() => openDrawer(agent.agentId)} />
      ))}
      {overflow > 0 && (
        <span className="text-xs text-muted-foreground">
          +{overflow} 个 Agent 工作中
        </span>
      )}
    </div>
  );
}
```

### 2.8 Agent 会话抽屉

```tsx
// AgentDrawer.tsx — 320px 右侧滑入
export function AgentDrawer({ agentId, onClose }: Props) {
  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-background border-l shadow-xl
                    z-50 animate-slideInRight">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">{agent.displayName}</h3>
        <button onClick={onClose}>✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {/* Agent 会话消息流 — SSE 驱动 */}
      </div>
    </div>
  );
}
```

### 2.9 快捷命令面板

```typescript
// CommandPalette.tsx
const COMMANDS = [
  { command: "/write", label: "写作", description: "开始写第 N 章" },
  { command: "/review", label: "审校", description: "审校第 N 章" },
  { command: "/status", label: "进度", description: "查看项目总体进度" },
  { command: "/export", label: "导出", description: "导出已完成章节" },
  { command: "/brainstorm", label: "脑暴", description: "开始新一轮脑暴" },
  { command: "/analyze", label: "分析", description: "析典分析第 N 章" },
  { command: "/lesson", label: "教训", description: "查看写作教训" },
  { command: "/style", label: "文风", description: "查看/调整文风" },
  { command: "/rollback", label: "回滚", description: "回滚到某版本" },
];
```

输入 `/` 触发浮层，上下键导航，Enter 选中，Esc 关闭。
选中后命令文本插入输入框（如 `/write 3`），用户按 Enter 发送。

### 2.10 Zustand Chat Store

```typescript
// packages/web/src/stores/chat-store.ts
interface ChatState {
  messages: ChatMessage[];
  streamingText: string;
  isStreaming: boolean;
  inputMode: "normal" | "question";
  questionOptions: QuestionOption[] | null;

  // Actions
  addMessage: (msg: ChatMessage) => void;
  appendStreamText: (chunk: string) => void;
  finalizeStream: () => void;
  setQuestionMode: (options: QuestionOption[]) => void;
  resetInputMode: () => void;
  sendMessage: (text: string) => Promise<void>;
}
```

### 2.11 新增依赖

| 包 | 用途 | 安装位置 |
|----|------|---------|
| `react-markdown` | Markdown 渲染 | web |
| `remark-gfm` | GitHub Flavored Markdown | web |

## 3. 不需要改动的部分

- `components/ui/` shadcn 组件
- `lib/api.ts` API client
- `layout.tsx` 根 Layout
- `globals.css` Tailwind 入口

## 4. 风险与注意事项

- **分隔条拖拽性能**：需使用 `requestAnimationFrame` 限流 `mousemove` 事件
- **流式渲染性能**：高频 text 事件需要 RAF 节流，避免每 token 触发 re-render
- **Question Panel 状态管理**：`interaction_mode` 事件必须正确切换输入模式并恢复
- **Agent Drawer + InfoPanel 共存**：Drawer 是 fixed overlay，不影响 InfoPanel 布局
- **移动端 Tab 切换**：< 768px 下需完全不同的布局逻辑
