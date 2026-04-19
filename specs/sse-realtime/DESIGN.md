# sse-realtime — DESIGN

> **状态**：已完成
> **模块**：sse-realtime

## 1. 当前状态

| 组件 | 状态 | V2 改动 |
|------|------|---------|
| `core/events/` | ✅ EventBus + EventBuffer | 可复用于服务端事件广播 |
| SSE 服务端 | ❌ 不存在 | 全新构建 |
| SSE 客户端 | ❌ 不存在 | 全新构建 |
| Hono SSE 支持 | ✅ 内置 | `c.streamSSE()` / `hono/streaming` |

## 2. 技术方案

### 2.1 服务端架构总览

```
OpenCode 事件流 → EventTransformer → SSEBroadcaster → Hono SSE 端点 → 浏览器
                                         ↑
                                    EventBuffer（断线回放）
```

### 2.2 事件变换器（EventTransformer）

将 OpenCode 原生事件转换为前端 SSE 事件格式：

```typescript
// packages/server/src/sse/transformer.ts

/** 前端接收的统一事件格式 */
interface SSEEvent {
  id: string;                    // 单调递增事件 ID（用于断线恢复）
  type: SSEEventType;
  data: Record<string, unknown>;
  timestamp: number;
}

type SSEEventType =
  | "text"               // 墨衡流式文本
  | "tool_call"          // Agent 调用 MCP 工具
  | "tool_result"        // MCP 工具返回
  | "subtask_start"      // 子 Agent 开始
  | "subtask_progress"   // 子 Agent 进展
  | "subtask_end"        // 子 Agent 完成
  | "error"              // 错误
  | "interaction_mode"   // 需要用户决策
  | "chapter.start"      // 章节写作开始
  | "chapter.token"      // 章节文字追加
  | "chapter.complete"   // 章节写作完成
  | "brainstorm.diverge" // 脑暴发散
  | "brainstorm.converge"// 脑暴聚焦
  | "brainstorm.crystallize"; // 脑暴结晶

export class EventTransformer {
  private eventCounter = 0;

  /** 将 OpenCode 原生事件转换为 SSE 事件 */
  transform(raw: OpenCodeEvent): SSEEvent | null {
    this.eventCounter++;
    // 根据 raw.type 映射到 SSEEventType...
  }
}
```

### 2.3 SSE 广播器（SSEBroadcaster）

管理每个 session 的 SSE 连接和事件缓冲：

```typescript
// packages/server/src/sse/broadcaster.ts

interface SSEConnection {
  sessionId: string;
  stream: WritableStreamDefaultWriter;
  lastEventId: number;
}

export class SSEBroadcaster {
  private connections = new Map<string, Set<SSEConnection>>();
  private buffers = new Map<string, EventBuffer>();

  /** 注册新连接 */
  addConnection(sessionId: string, conn: SSEConnection): void;

  /** 移除连接（断线） */
  removeConnection(sessionId: string, conn: SSEConnection): void;

  /** 广播事件到指定 session 的所有连接 */
  broadcast(sessionId: string, event: SSEEvent): void;

  /** 回放缓冲事件（断线恢复） */
  replay(sessionId: string, afterEventId: number): SSEEvent[];

  /** 清理过期 session 的缓冲 */
  cleanup(maxAge: number): void;
}
```

### 2.4 EventBuffer（断线回放）

复用 `@moran/core/events` 的 EventBuffer，用于 SSE 断线恢复：

```typescript
// 使用 core 已有的 EventBuffer
import { EventBuffer } from "@moran/core/events";

// 每个 session 维护最近 1000 个事件的环形缓冲
const buffer = new EventBuffer({ maxSize: 1000, maxAge: 5 * 60 * 1000 });
```

### 2.5 Hono SSE 端点实现

```typescript
// packages/server/src/routes/chat.ts（SSE 端点部分）
import { streamSSE } from "hono/streaming";

routes.get("/events", async (c) => {
  const sessionId = c.req.query("sessionId");
  if (!sessionId) return fail(c, "VALIDATION_ERROR", "Missing sessionId", 400);

  const lastEventId = c.req.header("Last-Event-Id");

  return streamSSE(c, async (stream) => {
    // 1. 断线恢复：回放 lastEventId 之后的缓冲事件
    if (lastEventId) {
      const missed = broadcaster.replay(sessionId, parseInt(lastEventId));
      for (const event of missed) {
        await stream.writeSSE({ id: String(event.id), event: event.type, data: JSON.stringify(event.data) });
      }
    }

    // 2. 订阅 OpenCode 实时事件
    const transformer = new EventTransformer();
    const subscription = sessionManager.subscribeEvents(sessionId);

    // 3. 心跳定时器
    const heartbeat = setInterval(async () => {
      await stream.writeSSE({ event: "heartbeat", data: "" });
    }, 30_000);

    try {
      for await (const rawEvent of subscription) {
        const sseEvent = transformer.transform(rawEvent);
        if (sseEvent) {
          broadcaster.buffer(sessionId, sseEvent);
          await stream.writeSSE({
            id: String(sseEvent.id),
            event: sseEvent.type,
            data: JSON.stringify(sseEvent.data),
          });
        }
      }
    } finally {
      clearInterval(heartbeat);
    }
  });
});
```

### 2.6 前端 SSE 客户端

```typescript
// packages/web/src/lib/sse-client.ts

export class SSEClient {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30_000;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private baseUrl: string,
    private handlers: SSEEventHandlers,
  ) {}

  connect(sessionId: string, lastEventId?: string): void {
    const url = new URL(`${this.baseUrl}/api/chat/events`);
    url.searchParams.set("sessionId", sessionId);

    this.eventSource = new EventSource(url.toString());

    // 连接成功
    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0;
      this.startHeartbeatMonitor();
    };

    // 注册所有事件类型
    for (const eventType of SSE_EVENT_TYPES) {
      this.eventSource.addEventListener(eventType, (e) => {
        this.resetHeartbeatMonitor();
        const data = JSON.parse(e.data);
        this.handlers[eventType]?.(data);
      });
    }

    // 错误 → 自动重连
    this.eventSource.onerror = () => {
      this.eventSource?.close();
      this.scheduleReconnect(sessionId);
    };
  }

  private scheduleReconnect(sessionId: string): void {
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );
    this.reconnectAttempts++;
    setTimeout(() => this.connect(sessionId), delay);
  }

  private startHeartbeatMonitor(): void {
    this.heartbeatTimeout = setTimeout(() => {
      // 60s 无心跳 → 主动重连
      this.eventSource?.close();
      this.connect(/* sessionId */);
    }, 60_000);
  }

  private resetHeartbeatMonitor(): void {
    if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
    this.startHeartbeatMonitor();
  }

  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
    if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
  }
}
```

### 2.7 Zustand SSE Store

```typescript
// packages/web/src/stores/sse-store.ts
import { create } from "zustand";

interface SSEState {
  connectionState: "connecting" | "connected" | "disconnected";
  reconnectAttempts: number;
  client: SSEClient | null;

  // Actions
  connect: (sessionId: string) => void;
  disconnect: () => void;
}

export const useSSEStore = create<SSEState>((set, get) => ({
  connectionState: "disconnected",
  reconnectAttempts: 0,
  client: null,

  connect: (sessionId) => {
    const client = new SSEClient("/api", {
      text: (data) => useChatStore.getState().appendText(data),
      subtask_start: (data) => useAgentStore.getState().addAgent(data),
      tool_result: (data) => usePanelStore.getState().handleToolResult(data),
      // ... 其他事件 handler
    });
    client.connect(sessionId);
    set({ client, connectionState: "connected" });
  },

  disconnect: () => {
    get().client?.disconnect();
    set({ client: null, connectionState: "disconnected" });
  },
}));
```

### 2.8 面板事件路由（tool_result → Tab 映射）

```typescript
// packages/web/src/lib/panel-event-router.ts

const TOOL_TAB_MAP: Record<string, string> = {
  brainstorm_create: "brainstorm",
  brainstorm_update: "brainstorm",
  world_setting_create: "settings",
  world_setting_update: "settings",
  world_subsystem_create: "settings",
  world_subsystem_update: "settings",
  character_create: "characters",
  character_update: "characters",
  relationship_create: "characters",
  outline_create: "outline",
  outline_update: "outline",
  chapter_write: "chapters",
  chapter_revise: "chapters",
  chapter_archive: "chapters",
  review_round1: "reviews",
  review_round2: "reviews",
  review_round3: "reviews",
  review_round4: "reviews",
  analysis_run: "analysis",
  knowledge_write: "knowledge",
  lesson_learn: "knowledge",
};

export function routeToolResultToTab(toolName: string): string | null {
  return TOOL_TAB_MAP[toolName] ?? null;
}
```

### 2.9 10 秒操作保护

```typescript
// packages/web/src/stores/ui-store.ts（部分）
interface UIState {
  lastUserActionTime: number;
  updateLastAction: () => void;
}

// 在面板组件中监听用户操作
useEffect(() => {
  const update = () => uiStore.getState().updateLastAction();
  const events = ["click", "scroll", "keydown", "selectstart"];
  events.forEach((e) => panelRef.current?.addEventListener(e, update));
  return () => events.forEach((e) => panelRef.current?.removeEventListener(e, update));
}, []);
```

### 2.10 Agent 状态管理

```typescript
// packages/web/src/stores/agent-store.ts
import { create } from "zustand";

interface AgentStatus {
  agentId: string;
  displayName: string;
  state: "active" | "queued" | "background" | "just_finished";
  description: string;
  startedAt: number;
  targetTab?: string;
}

interface AgentState {
  agents: Map<string, AgentStatus>;
  addAgent: (data: AgentStatus) => void;
  updateAgent: (agentId: string, update: Partial<AgentStatus>) => void;
  removeAgent: (agentId: string) => void;
  restoreFromAPI: (statuses: AgentStatus[]) => void;
}
```

### 2.11 离线缓存（IndexedDB）

使用 `idb` 库进行面板数据持久化：

```typescript
// packages/web/src/lib/offline-cache.ts
import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "moran-panel-cache";
const DB_VERSION = 1;

export async function openCache(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore("panel-data", { keyPath: "key" });
    },
  });
}

export async function cacheTabData(projectId: string, tab: string, data: unknown): Promise<void> {
  const db = await openCache();
  await db.put("panel-data", { key: `${projectId}:${tab}`, data, timestamp: Date.now() });
}

export async function getCachedTabData(projectId: string, tab: string): Promise<unknown | null> {
  const db = await openCache();
  const entry = await db.get("panel-data", `${projectId}:${tab}`);
  return entry?.data ?? null;
}
```

### 2.12 新增依赖

| 包 | 用途 | 安装位置 |
|----|------|---------|
| `idb` | IndexedDB 封装 | web |

## 3. 不需要改动的部分

- `@moran/core/events` EventBus + EventBuffer（直接复用）
- Hono 框架的 SSE 支持（内置 `hono/streaming`）
- Next.js rewrite 代理（SSE 天然支持代理）

## 4. 风险与注意事项

- **Hono streamSSE 生命周期**：确保连接关闭时清理资源（subscription, heartbeat timer）
- **EventSource 兼容性**：现代浏览器原生支持，无需 polyfill
- **SSE 通过 Next.js rewrite**：验证 Next.js rewrite 不会缓冲 SSE 响应（需要 `Transfer-Encoding: chunked`）
- **高频事件节流**：`chapter.token` 每 ~500ms 推送一次，前端需 requestAnimationFrame 节流渲染
- **EventBuffer 内存**：每 session 最多缓存 1000 事件，5 分钟过期，避免内存泄漏
