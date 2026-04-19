/**
 * Settings Store — Zustand store for project settings.
 * Manages basic info + all settings fields with optimistic updates and dirty tracking.
 *
 * Phase 9: Settings Panel
 */

import { create } from "zustand";
import { api } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectSettings {
  writerStyle?: { styleName: string; model?: string };
  modelOverrides?: Record<string, string>;
  budgetLimitUsd?: number;
  budgetBehavior?: "pause" | "warn";
  writingParams?: {
    chapterWordCount?: number;
    temperature?: number;
    topP?: number;
    reviewThreshold?: number;
  };
}

export interface ProjectBasicInfo {
  title: string;
  genre: string | null;
  subGenre: string | null;
  createdAt: string | null;
}

export type SettingsPatch = Partial<{
  title: string;
  genre: string;
  subGenre: string;
  status: string;
  settings: Partial<ProjectSettings>;
}>;

// ── Store interface ────────────────────────────────────────────────────────────

interface SettingsState {
  basicInfo: ProjectBasicInfo;
  settings: ProjectSettings;
  originalBasicInfo: ProjectBasicInfo;
  originalSettings: ProjectSettings;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveSuccess: boolean;
}

interface SettingsActions {
  loadSettings: (projectId: string) => Promise<void>;
  updateSettings: (projectId: string, patch: SettingsPatch) => Promise<boolean>;
  isDirty: () => boolean;
  reset: () => void;
  clearMessages: () => void;
}

export type SettingsStore = SettingsState & SettingsActions;

// ── Default values ─────────────────────────────────────────────────────────────

const defaultBasicInfo: ProjectBasicInfo = {
  title: "",
  genre: null,
  subGenre: null,
  createdAt: null,
};

const defaultSettings: ProjectSettings = {};

// ── API response shape ─────────────────────────────────────────────────────────

interface ApiResponse<T> {
  ok: boolean;
  data: T;
  error?: { code: string; message: string };
}

interface ProjectApiData {
  id: string;
  title: string;
  genre?: string | null;
  subGenre?: string | null;
  settings?: ProjectSettings | null;
  createdAt?: string | null;
}

// ── Store ──────────────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
  basicInfo: { ...defaultBasicInfo },
  settings: { ...defaultSettings },
  originalBasicInfo: { ...defaultBasicInfo },
  originalSettings: { ...defaultSettings },
  isLoading: false,
  isSaving: false,
  error: null,
  saveSuccess: false,

  loadSettings: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get<ApiResponse<ProjectApiData>>(`/api/projects/${projectId}`);
      if (!res.ok) {
        set({ isLoading: false, error: res.error?.message ?? "加载失败" });
        return;
      }
      const data = res.data;
      const basicInfo: ProjectBasicInfo = {
        title: data.title,
        genre: data.genre ?? null,
        subGenre: data.subGenre ?? null,
        createdAt: data.createdAt ?? null,
      };
      const settings: ProjectSettings = data.settings ?? {};
      set({
        basicInfo: { ...basicInfo },
        settings: { ...settings },
        originalBasicInfo: { ...basicInfo },
        originalSettings: { ...settings },
        isLoading: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "网络错误";
      set({ isLoading: false, error: message });
    }
  },

  updateSettings: async (projectId: string, patch: SettingsPatch) => {
    const prev = get();
    const prevBasicInfo = { ...prev.basicInfo };
    const prevSettings = { ...prev.settings };

    // Optimistic update
    const nextBasicInfo: ProjectBasicInfo = {
      ...prev.basicInfo,
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.genre !== undefined && { genre: patch.genre }),
      ...(patch.subGenre !== undefined && { subGenre: patch.subGenre }),
    };
    const nextSettings: ProjectSettings =
      patch.settings !== undefined
        ? { ...prev.settings, ...patch.settings }
        : prev.settings;

    set({ basicInfo: nextBasicInfo, settings: nextSettings, isSaving: true, error: null, saveSuccess: false });

    try {
      const res = await api.patch<ApiResponse<ProjectApiData>>(`/api/projects/${projectId}`, patch);
      if (!res.ok) {
        // Rollback
        set({
          basicInfo: prevBasicInfo,
          settings: prevSettings,
          isSaving: false,
          error: res.error?.message ?? "保存失败",
        });
        return false;
      }
      // Update originals to the saved values
      set({
        originalBasicInfo: { ...nextBasicInfo },
        originalSettings: { ...nextSettings },
        isSaving: false,
        saveSuccess: true,
      });
      return true;
    } catch (err: unknown) {
      // Rollback
      const message = err instanceof Error ? err.message : "网络错误";
      set({
        basicInfo: prevBasicInfo,
        settings: prevSettings,
        isSaving: false,
        error: message,
      });
      return false;
    }
  },

  isDirty: () => {
    const s = get();
    return (
      JSON.stringify(s.basicInfo) !== JSON.stringify(s.originalBasicInfo) ||
      JSON.stringify(s.settings) !== JSON.stringify(s.originalSettings)
    );
  },

  reset: () => {
    set({
      basicInfo: { ...defaultBasicInfo },
      settings: { ...defaultSettings },
      originalBasicInfo: { ...defaultBasicInfo },
      originalSettings: { ...defaultSettings },
      isLoading: false,
      isSaving: false,
      error: null,
      saveSuccess: false,
    });
  },

  clearMessages: () => {
    set({ error: null, saveSuccess: false });
  },
}));
