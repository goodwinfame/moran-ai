/**
 * Project List Store — Zustand store for the project list page.
 * Manages project data, inline chat messages, and async operations.
 */

import { create } from "zustand";
import { api } from "@/lib/api";

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

  fetchProjects: () => Promise<void>;
  createProject: (title: string, genre?: string) => Promise<string>;
  deleteProject: (id: string) => Promise<void>;
  renameProject: (id: string, title: string) => Promise<void>;
  pinProject: (id: string) => Promise<void>;
  archiveProject: (id: string) => Promise<void>;
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

/** Trim to max 3 rounds (6 messages): remove the oldest pair */
function trimMessages(msgs: InlineMessage[]): InlineMessage[] {
  if (msgs.length <= MAX_INLINE_MESSAGES) return msgs;
  // Remove oldest pair (first 2 messages)
  return msgs.slice(msgs.length - MAX_INLINE_MESSAGES);
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useProjectListStore = create<ProjectListState>()((set, get) => ({
  projects: [],
  isLoading: false,
  isSending: false,
  inlineMessages: [],

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

  sendInlineMessage: async (message: string) => {
    // Add user message immediately
    const userMsg: InlineMessage = { role: "user", content: message };
    set((state) => ({
      isSending: true,
      inlineMessages: trimMessages([...state.inlineMessages, userMsg]),
    }));

    try {
      const res = await api.post<{ ok: true; data: InlineReply }>("/api/chat/send", {
        projectId: null,
        message,
      });
      const reply = res.data;

      const assistantMsg: InlineMessage = { role: "assistant", content: reply.text };
      set((state) => ({
        isSending: false,
        inlineMessages: trimMessages([...state.inlineMessages, assistantMsg]),
      }));

      return reply;
    } catch (err) {
      console.error("[project-list-store] sendInlineMessage failed:", err);
      const errorMsg: InlineMessage = {
        role: "assistant",
        content: "网络异常，请重试",
      };
      set((state) => ({
        isSending: false,
        inlineMessages: trimMessages([...state.inlineMessages, errorMsg]),
      }));
      return null;
    }
  },

  clearInlineMessages: () => {
    set({ inlineMessages: [] });
  },
}));
