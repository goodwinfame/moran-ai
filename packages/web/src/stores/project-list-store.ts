/**
 * Project List Store — Zustand store for the project list page.
 * Manages project data, inline chat messages, and async operations.
 */

import { create } from "zustand";
import { api } from "@/lib/api";
import { SSEClient } from "@/lib/sse-client";

// Persistent SSE client — lives for the duration of the page session
let persistentSSEClient: SSEClient | null = null;
// Handlers for the currently in-flight message (replaced per message)
let currentMessageHandlers: {
  onText: (data: Record<string, unknown>) => void;
  onToolCall: (data: Record<string, unknown>) => void;
  onSubtaskStart: (data: Record<string, unknown>) => void;
  onMessageComplete: () => void;
  onError: (data: Record<string, unknown>) => void;
} | null = null;
// Resolve waiting for SSE connection to be ready
let sseReadyResolve: (() => void) | null = null;
let sseReady = false;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProjectItem {
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

export interface InlineReply {
  text: string;
  action?: {
    type: "navigate" | "create_project";
    projectId?: string;
    title?: string;
    genre?: string;
  };
}

interface InlineMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ProjectListState {
  projects: ProjectItem[];
  isLoading: boolean;
  isSending: boolean;
  inlineMessages: InlineMessage[];
  streamingReply: string;
  /** Status text shown while AI is thinking (before first text token) */
  thinkingStatus: string;
  /** Cached OpenCode sessionId (pre-warmed on page load to avoid 20s delay) */
  sessionId: string | null;

  fetchProjects: () => Promise<void>;
  createProject: (title: string, genre?: string) => Promise<string>;
  deleteProject: (id: string) => Promise<void>;
  renameProject: (id: string, title: string) => Promise<void>;
  pinProject: (id: string) => Promise<void>;
  archiveProject: (id: string) => Promise<void>;
  /** Pre-warm the OpenCode session and establish persistent SSE connection */
  initSession: () => Promise<void>;
  sendInlineMessage: (message: string) => Promise<InlineReply | null>;
  clearInlineMessages: () => void;
}

// ── Sorting ──────────────────────────────────────────────────────────────────

function sortProjects(projects: ProjectItem[]): ProjectItem[] {
  return [...projects].sort((a, b) => {
    // Pinned items first
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    // Then by updatedAt descending
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

// Max 3 rounds = 6 messages total
const MAX_INLINE_MESSAGES = 6;

/** Agent English name → Chinese display name */
const AGENT_NAMES: Record<string, string> = {
  moheng: "墨衡",
  lingxi: "灵犀",
  jiangxin: "匠心",
  mingjing: "明镜",
  zaishi: "载史",
  bowen: "博闻",
  xidian: "析典",
  shuchong: "书虫",
  dianjing: "点睛",
};

/** Trim to max 3 rounds (6 messages): remove the oldest pair */
function trimMessages(msgs: InlineMessage[]): InlineMessage[] {
  if (msgs.length <= MAX_INLINE_MESSAGES) return msgs;
  // Remove oldest pair (first 2 messages)
  return msgs.slice(msgs.length - MAX_INLINE_MESSAGES);
}

// ── Action Parsing ───────────────────────────────────────────────────────────

/** Parse <!--ACTION:{...}--> from agent response text */
function parseAction(text: string): InlineReply["action"] | undefined {
  const match = text.match(/<!--ACTION:(.*?)-->/);
  if (!match?.[1]) return undefined;
  try {
    const action = JSON.parse(match[1]) as Record<string, unknown>;
    if (action.type === "create_project" && typeof action.title === "string") {
      return {
        type: "create_project",
        title: action.title,
        genre: typeof action.genre === "string" ? action.genre : undefined,
      };
    }
    if (action.type === "navigate" && typeof action.projectId === "string") {
      return { type: "navigate", projectId: action.projectId };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Strip <!--ACTION:...--> from display text */
function stripAction(text: string): string {
  return text.replace(/<!--ACTION:.*?-->/g, "").trim();
}

/** Build message with project list context for moheng-home */
function buildContextMessage(message: string, projects: ProjectItem[]): string {
  if (projects.length === 0) return message;
  const list = projects
    .map((p) => `"${p.title}"(id:${p.id},${p.status},${p.currentChapter}/${p.chapterCount}章)`)
    .join(", ");
  return `[项目列表: ${list}]\n${message}`;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useProjectListStore = create<ProjectListState>()((set, get) => {
  // Inner helper — accesses module-level SSE vars; closed over set for onConnect
  function createPersistentClient(sessionId: string): SSEClient {
    sseReady = false;
    return new SSEClient("/api", {
      onConnect: () => {
        console.log("[chat-timing] persistent SSE onConnect");
        sseReady = true;
        sseReadyResolve?.();
        sseReadyResolve = null;
      },
      text: (data) => {
        currentMessageHandlers?.onText(data);
      },
      tool_call: (data) => {
        currentMessageHandlers?.onToolCall(data);
      },
      subtask_start: (data) => {
        currentMessageHandlers?.onSubtaskStart(data);
      },
      message_complete: () => {
        currentMessageHandlers?.onMessageComplete();
      },
      error: (data) => {
        currentMessageHandlers?.onError(data);
      },
    });
  }

  return {
    projects: [],
    isLoading: false,
    isSending: false,
    inlineMessages: [],
    streamingReply: "",
    thinkingStatus: "",
    sessionId: null,

    fetchProjects: async () => {
      set({ isLoading: true });
      try {
        const res = await api.get<{ ok: true; data: ProjectItem[] }>("/api/projects");
        set({ projects: sortProjects(res.data), isLoading: false });
      } catch (err) {
        console.error("[project-list-store] fetchProjects failed:", err);
        set({ isLoading: false });
      }
    },

    createProject: async (title: string, genre?: string) => {
      try {
        const res = await api.post<{ ok: true; data: ProjectItem }>("/api/projects", {
          title,
          genre,
        });
        const newProject = res.data;
        set((state) => ({
          projects: sortProjects([...state.projects, newProject]),
        }));
        return newProject.id;
      } catch (err) {
        console.error("[project-list-store] createProject failed:", err);
        return "";
      }
    },

    deleteProject: async (id: string) => {
      try {
        await api.delete<{ ok: true }>(`/api/projects/${id}`);
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
        }));
      } catch (err) {
        console.error("[project-list-store] deleteProject failed:", err);
      }
    },

    renameProject: async (id: string, title: string) => {
      try {
        const res = await api.put<{ ok: true; data: ProjectItem }>(`/api/projects/${id}`, {
          title,
        });
        const updated = res.data;
        set((state) => ({
          projects: sortProjects(
            state.projects.map((p) => (p.id === id ? { ...p, ...updated } : p)),
          ),
        }));
      } catch (err) {
        console.error("[project-list-store] renameProject failed:", err);
      }
    },

    pinProject: async (id: string) => {
      const current = get().projects.find((p) => p.id === id);
      if (!current) return;
      const isPinned = !current.isPinned;
      try {
        const res = await api.put<{ ok: true; data: ProjectItem }>(`/api/projects/${id}`, {
          isPinned,
        });
        const updated = res.data;
        set((state) => ({
          projects: sortProjects(
            state.projects.map((p) => (p.id === id ? { ...p, ...updated } : p)),
          ),
        }));
      } catch (err) {
        console.error("[project-list-store] pinProject failed:", err);
      }
    },

    archiveProject: async (id: string) => {
      try {
        await api.put<{ ok: true; data: ProjectItem }>(`/api/projects/${id}`, {
          status: "archived",
        });
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
        }));
      } catch (err) {
        console.error("[project-list-store] archiveProject failed:", err);
      }
    },

    initSession: async () => {
      try {
        const res = await api.get<{ ok: true; data: { sessionId: string } }>(
          "/api/chat/session",
        );
        const sessionId = res.data.sessionId;
        set({ sessionId });
        // Establish persistent SSE connection
        persistentSSEClient?.disconnect();
        sseReady = false;
        sseReadyResolve = null;
        persistentSSEClient = createPersistentClient(sessionId);
        persistentSSEClient.connect(sessionId);
        console.log("[chat-timing] initSession: session ready, SSE connecting");
      } catch (err) {
        console.error("[project-list-store] initSession failed:", err);
      }
    },

    sendInlineMessage: async (message: string) => {
      const userMsg: InlineMessage = { role: "user", content: message };
      set((state) => ({
        isSending: true,
        streamingReply: "",
        thinkingStatus: "墨衡正在思考...",
        inlineMessages: trimMessages([...state.inlineMessages, userMsg]),
      }));

      const t0 = performance.now();
      const elapsed = (label: string) =>
        console.log(`[chat-timing] ${label}: +${(performance.now() - t0).toFixed(0)}ms`);

      try {
        // Ensure session exists (fallback if initSession wasn't called or failed)
        let sessionId = get().sessionId;
        if (!sessionId) {
          elapsed("no session — calling initSession");
          await get().initSession();
          sessionId = get().sessionId;
        }
        if (!sessionId) {
          throw new Error("Failed to get session");
        }

        // Ensure SSE is connected — wait up to 10s if still connecting
        if (!sseReady) {
          elapsed("SSE not ready yet — waiting");
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              sseReadyResolve = null;
              resolve(); // proceed anyway after timeout
            }, 10_000);
            sseReadyResolve = () => {
              clearTimeout(timeout);
              resolve();
            };
          });
          elapsed("SSE ready (waited)");
        }

        const contextMessage = buildContextMessage(message, get().projects);

        return await new Promise<InlineReply | null>((resolve) => {
          let accumulatedText = "";

          const finish = (text: string | null) => {
            clearTimeout(timeoutId);
            currentMessageHandlers = null;
            if (text) {
              const action = parseAction(text);
              const displayText = stripAction(text);
              const assistantMsg: InlineMessage = { role: "assistant", content: displayText };
              set((state) => ({
                isSending: false,
                streamingReply: "",
                thinkingStatus: "",
                inlineMessages: trimMessages([...state.inlineMessages, assistantMsg]),
              }));
              resolve({ text: displayText, action });
            } else {
              set({ isSending: false, streamingReply: "", thinkingStatus: "" });
              resolve(null);
            }
          };

          const timeoutId = setTimeout(() => {
            finish(accumulatedText || null);
            if (!accumulatedText) {
              set((state) => ({
                inlineMessages: trimMessages([
                  ...state.inlineMessages,
                  { role: "assistant", content: "回复超时，请重试" },
                ]),
              }));
            }
          }, 120_000);

          currentMessageHandlers = {
            onText: (data) => {
              elapsed("first text token");
              const chunk = typeof data.text === "string" ? data.text : "";
              accumulatedText += chunk;
              set({ streamingReply: stripAction(accumulatedText), thinkingStatus: "" });
            },
            onToolCall: (data) => {
              if (!accumulatedText) {
                const toolName = typeof data.toolName === "string" ? data.toolName : "";
                if (toolName) set({ thinkingStatus: `正在调用 ${toolName}...` });
              }
            },
            onSubtaskStart: (data) => {
              if (!accumulatedText) {
                const part = data.part as Record<string, unknown> | undefined;
                const agentId =
                  (typeof part?.["name"] === "string" ? part["name"] : "") ||
                  (typeof part?.["agent"] === "string" ? part["agent"] : "");
                const displayName = AGENT_NAMES[agentId] ?? agentId;
                set({
                  thinkingStatus: displayName ? `${displayName}正在工作...` : "子任务处理中...",
                });
              }
            },
            onMessageComplete: () => {
              elapsed("message_complete");
              finish(accumulatedText);
            },
            onError: (data) => {
              const errorContent = typeof data.message === "string" ? data.message : "发生错误";
              set((state) => ({
                inlineMessages: trimMessages([
                  ...state.inlineMessages,
                  { role: "assistant", content: errorContent },
                ]),
              }));
              finish(null);
            },
          };

          elapsed("POST /send fired");
          api
            .post("/api/chat/send", {
              projectId: null,
              message: contextMessage,
              agent: "moheng-home",
            })
            .catch((err: unknown) => {
              const errStr = typeof err === "object" && err !== null ? JSON.stringify(err) : String(err);
              console.error("[project-list-store] POST /send failed:", errStr);
              clearTimeout(timeoutId);
              currentMessageHandlers = null;
              set((state) => ({
                isSending: false,
                streamingReply: "",
                inlineMessages: trimMessages([
                  ...state.inlineMessages,
                  { role: "assistant", content: "发送失败，请重试" },
                ]),
              }));
              resolve(null);
            });
        });
      } catch (err) {
        console.error("[project-list-store] sendInlineMessage failed:", err);
        set((state) => ({
          isSending: false,
          streamingReply: "",
          inlineMessages: trimMessages([
            ...state.inlineMessages,
            { role: "assistant", content: "网络异常，请重试" },
          ]),
        }));
        return null;
      }
    },

    clearInlineMessages: () => {
      currentMessageHandlers = null;
      set({ inlineMessages: [], streamingReply: "" });
    },
  };
});
