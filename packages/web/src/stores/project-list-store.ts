/**
 * Project List Store — Zustand store for the project list page.
 * Manages project data, inline chat messages, and async operations.
 */

import { create } from "zustand";
import { api } from "@/lib/api";
import { SSEClient } from "@/lib/sse-client";

// Module-level SSE client for cleanup (NOT in Zustand state — avoids serialization issues)
let activeSSEClient: SSEClient | null = null;

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
  /** Pre-warm the OpenCode session so first message doesn't block on session creation */
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

export const useProjectListStore = create<ProjectListState>()((set, get) => ({
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
      set({ sessionId: res.data.sessionId });
    } catch (err) {
      console.error("[project-list-store] initSession failed:", err);
      // Non-fatal: sendInlineMessage will fall back to fetching session on demand
    }
  },

  sendInlineMessage: async (message: string) => {
    // 1. Add user message immediately
    const userMsg: InlineMessage = { role: "user", content: message };
    set((state) => ({
      isSending: true,
      streamingReply: "",
      thinkingStatus: "正在连接...",
      inlineMessages: trimMessages([...state.inlineMessages, userMsg]),
    }));

    // 2. Disconnect any previous SSE client
    activeSSEClient?.disconnect();
    activeSSEClient = null;

    try {
      // 3. Use pre-warmed session or fetch on demand (fallback)
      let sessionId = get().sessionId;
      if (!sessionId) {
        const sessionRes = await api.get<{ ok: true; data: { sessionId: string } }>(
          "/api/chat/session",
        );
        sessionId = sessionRes.data.sessionId;
        set({ sessionId });
      }

      // 4. Build message with project context for moheng-home
      const contextMessage = buildContextMessage(message, get().projects);

      // 5. Connect SSE → wait for onConnect → THEN send message
      //    This eliminates the race condition where events are emitted
      //    before the SSE subscription is established.
      return await new Promise<InlineReply | null>((resolve) => {
        let accumulatedText = "";
        let messageSent = false;

        const finish = (text: string | null) => {
          clearTimeout(timeoutId);
          client.disconnect();
          activeSSEClient = null;
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
            const errorMsg: InlineMessage = { role: "assistant", content: "回复超时，请重试" };
            set((state) => ({
              inlineMessages: trimMessages([...state.inlineMessages, errorMsg]),
            }));
          }
        }, 120_000);

        const sendMessage = () => {
          if (messageSent) return;
          messageSent = true;
          api
            .post("/api/chat/send", {
              projectId: null,
              message: contextMessage,
              agent: "moheng-home",
            })
            .catch((err: unknown) => {
              console.error("[project-list-store] POST /send failed:", err);
              clearTimeout(timeoutId);
              client.disconnect();
              activeSSEClient = null;
              const errorMsg: InlineMessage = { role: "assistant", content: "发送失败，请重试" };
              set((state) => ({
                isSending: false,
                streamingReply: "",
                inlineMessages: trimMessages([...state.inlineMessages, errorMsg]),
              }));
              resolve(null);
            });
        };

        const client = new SSEClient("/api", {
          onConnect: () => {
            // SSE stream established — NOW safe to send the message
            set({ thinkingStatus: "墨衡正在思考..." });
            sendMessage();
          },
          text: (data) => {
            // In case onConnect didn't fire (reconnect scenario), send on first data
            sendMessage();
            const chunk = typeof data.text === "string" ? data.text : "";
            accumulatedText += chunk;
            // Strip action markers from streaming display
            set({ streamingReply: stripAction(accumulatedText), thinkingStatus: "" });
          },
          tool_call: (data) => {
            // moheng-home should NOT call tools, but handle gracefully
            if (!accumulatedText) {
              const toolName = typeof data.toolName === "string" ? data.toolName : "";
              if (toolName) {
                set({ thinkingStatus: `正在调用 ${toolName}...` });
              }
            }
          },
          subtask_start: (data) => {
            // moheng-home should NOT delegate, but handle gracefully
            if (!accumulatedText) {
              const part = data.part as Record<string, unknown> | undefined;
              const agentId =
                (typeof part?.["name"] === "string" ? part["name"] : "") ||
                (typeof part?.["agent"] === "string" ? part["agent"] : "");
              const displayName = AGENT_NAMES[agentId] ?? agentId;
              set({
                thinkingStatus: displayName
                  ? `${displayName}正在工作...`
                  : "子任务处理中...",
              });
            }
          },
          message_complete: () => {
            finish(accumulatedText);
          },
          error: (data) => {
            const errorContent = typeof data.message === "string" ? data.message : "发生错误";
            const errorMsg: InlineMessage = { role: "assistant", content: errorContent };
            set((state) => ({
              inlineMessages: trimMessages([...state.inlineMessages, errorMsg]),
            }));
            finish(null);
          },
        });

        activeSSEClient = client;
        client.connect(sessionId);
      });
    } catch (err) {
      console.error("[project-list-store] sendInlineMessage failed:", err);
      const errorMsg: InlineMessage = { role: "assistant", content: "网络异常，请重试" };
      set((state) => ({
        isSending: false,
        streamingReply: "",
        inlineMessages: trimMessages([...state.inlineMessages, errorMsg]),
      }));
      return null;
    }
  },

  clearInlineMessages: () => {
    activeSSEClient?.disconnect();
    activeSSEClient = null;
    set({ inlineMessages: [], streamingReply: "" });
  },
}));
