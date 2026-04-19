/**
 * Settings Store — Unit Tests
 *
 * Follows pattern from panel-store.test.ts.
 * Mocks @/lib/api module.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @/lib/api before importing the store
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

import { useSettingsStore } from "@/stores/settings-store";

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetStore() {
  useSettingsStore.setState({
    basicInfo: { title: "", genre: null, subGenre: null, createdAt: null },
    settings: {},
    originalBasicInfo: { title: "", genre: null, subGenre: null, createdAt: null },
    originalSettings: {},
    isLoading: false,
    isSaving: false,
    error: null,
    saveSuccess: false,
  });
}

async function getMockApi() {
  const { api } = await import("@/lib/api");
  return {
    get: api.get as ReturnType<typeof vi.fn>,
    patch: api.patch as ReturnType<typeof vi.fn>,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

afterEach(() => {
  resetStore();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("useSettingsStore", () => {
  describe("initial state", () => {
    it("starts with empty basicInfo", () => {
      const s = useSettingsStore.getState();
      expect(s.basicInfo.title).toBe("");
      expect(s.basicInfo.genre).toBeNull();
      expect(s.basicInfo.createdAt).toBeNull();
    });

    it("starts with empty settings", () => {
      const s = useSettingsStore.getState();
      expect(s.settings).toEqual({});
    });

    it("starts not loading or saving", () => {
      const s = useSettingsStore.getState();
      expect(s.isLoading).toBe(false);
      expect(s.isSaving).toBe(false);
    });

    it("isDirty() returns false initially", () => {
      expect(useSettingsStore.getState().isDirty()).toBe(false);
    });
  });

  describe("loadSettings()", () => {
    it("fetches project and populates basicInfo + settings", async () => {
      const mockApi = await getMockApi();
      mockApi.get.mockResolvedValueOnce({
        ok: true,
        data: {
          id: "proj-1",
          title: "My Novel",
          genre: "仙侠",
          subGenre: "修仙",
          createdAt: "2026-01-01T00:00:00Z",
          settings: {
            budgetLimitUsd: 50,
            budgetBehavior: "pause",
            writingParams: { chapterWordCount: 3000 },
          },
        },
      });

      await useSettingsStore.getState().loadSettings("proj-1");

      const s = useSettingsStore.getState();
      expect(s.basicInfo.title).toBe("My Novel");
      expect(s.basicInfo.genre).toBe("仙侠");
      expect(s.basicInfo.subGenre).toBe("修仙");
      expect(s.settings.budgetLimitUsd).toBe(50);
      expect(s.settings.budgetBehavior).toBe("pause");
      expect(s.settings.writingParams?.chapterWordCount).toBe(3000);
      expect(s.isLoading).toBe(false);
    });

    it("populates originalBasicInfo and originalSettings after load", async () => {
      const mockApi = await getMockApi();
      mockApi.get.mockResolvedValueOnce({
        ok: true,
        data: {
          id: "proj-1",
          title: "My Novel",
          genre: "仙侠",
          subGenre: null,
          createdAt: null,
          settings: { budgetLimitUsd: 100 },
        },
      });

      await useSettingsStore.getState().loadSettings("proj-1");

      const s = useSettingsStore.getState();
      expect(s.originalBasicInfo.title).toBe("My Novel");
      expect(s.originalSettings.budgetLimitUsd).toBe(100);
    });

    it("sets error when API returns ok: false", async () => {
      const mockApi = await getMockApi();
      mockApi.get.mockResolvedValueOnce({
        ok: false,
        error: { code: "NOT_FOUND", message: "项目不存在" },
      });

      await useSettingsStore.getState().loadSettings("missing");

      const s = useSettingsStore.getState();
      expect(s.error).toBe("项目不存在");
      expect(s.isLoading).toBe(false);
    });

    it("sets error on network failure", async () => {
      const mockApi = await getMockApi();
      mockApi.get.mockRejectedValueOnce(new Error("Network error"));

      await useSettingsStore.getState().loadSettings("proj-1");

      expect(useSettingsStore.getState().error).toBe("Network error");
    });

    it("handles null settings field in response", async () => {
      const mockApi = await getMockApi();
      mockApi.get.mockResolvedValueOnce({
        ok: true,
        data: {
          id: "proj-1",
          title: "Novel",
          genre: null,
          subGenre: null,
          createdAt: null,
          settings: null,
        },
      });

      await useSettingsStore.getState().loadSettings("proj-1");

      expect(useSettingsStore.getState().settings).toEqual({});
    });
  });

  describe("updateSettings()", () => {
    beforeEach(async () => {
      // Pre-populate store with loaded data
      useSettingsStore.setState({
        basicInfo: { title: "Original Title", genre: "仙侠", subGenre: null, createdAt: null },
        settings: { budgetLimitUsd: 10 },
        originalBasicInfo: { title: "Original Title", genre: "仙侠", subGenre: null, createdAt: null },
        originalSettings: { budgetLimitUsd: 10 },
        isLoading: false,
        isSaving: false,
        error: null,
        saveSuccess: false,
      });
    });

    it("does optimistic update then calls API", async () => {
      const mockApi = await getMockApi();
      mockApi.patch.mockResolvedValueOnce({
        ok: true,
        data: { id: "proj-1", title: "New Title", genre: "仙侠", settings: { budgetLimitUsd: 10 } },
      });

      // Check optimistic: title should update before await
      const promise = useSettingsStore.getState().updateSettings("proj-1", { title: "New Title" });
      expect(useSettingsStore.getState().basicInfo.title).toBe("New Title");

      const result = await promise;
      expect(result).toBe(true);
      expect(mockApi.patch).toHaveBeenCalledWith(
        "/api/projects/proj-1",
        expect.objectContaining({ title: "New Title" }),
      );
    });

    it("updates originalBasicInfo and originalSettings on success", async () => {
      const mockApi = await getMockApi();
      mockApi.patch.mockResolvedValueOnce({
        ok: true,
        data: { id: "proj-1", title: "Saved", settings: {} },
      });

      await useSettingsStore.getState().updateSettings("proj-1", { title: "Saved" });

      expect(useSettingsStore.getState().originalBasicInfo.title).toBe("Saved");
      expect(useSettingsStore.getState().saveSuccess).toBe(true);
    });

    it("rolls back on API failure", async () => {
      const mockApi = await getMockApi();
      mockApi.patch.mockResolvedValueOnce({
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "Server error" },
      });

      const result = await useSettingsStore.getState().updateSettings("proj-1", { title: "Bad Title" });

      expect(result).toBe(false);
      // Rolled back to original
      expect(useSettingsStore.getState().basicInfo.title).toBe("Original Title");
      expect(useSettingsStore.getState().error).toBe("Server error");
    });

    it("rolls back on network error", async () => {
      const mockApi = await getMockApi();
      mockApi.patch.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await useSettingsStore.getState().updateSettings("proj-1", { title: "Bad" });

      expect(result).toBe(false);
      expect(useSettingsStore.getState().basicInfo.title).toBe("Original Title");
      expect(useSettingsStore.getState().error).toBe("Connection refused");
    });

    it("merges settings patch with existing settings", async () => {
      const mockApi = await getMockApi();
      mockApi.patch.mockResolvedValueOnce({ ok: true, data: { id: "proj-1", title: "Original Title", settings: {} } });

      await useSettingsStore.getState().updateSettings("proj-1", {
        settings: { budgetBehavior: "warn" },
      });

      // budgetLimitUsd was 10, budgetBehavior should be merged
      expect(useSettingsStore.getState().settings.budgetLimitUsd).toBe(10);
      expect(useSettingsStore.getState().settings.budgetBehavior).toBe("warn");
    });
  });

  describe("isDirty()", () => {
    it("returns false when basicInfo matches original", () => {
      useSettingsStore.setState({
        basicInfo: { title: "T", genre: null, subGenre: null, createdAt: null },
        originalBasicInfo: { title: "T", genre: null, subGenre: null, createdAt: null },
        settings: {},
        originalSettings: {},
      });
      expect(useSettingsStore.getState().isDirty()).toBe(false);
    });

    it("returns true when title differs from original", () => {
      useSettingsStore.setState({
        basicInfo: { title: "Modified", genre: null, subGenre: null, createdAt: null },
        originalBasicInfo: { title: "Original", genre: null, subGenre: null, createdAt: null },
        settings: {},
        originalSettings: {},
      });
      expect(useSettingsStore.getState().isDirty()).toBe(true);
    });

    it("returns true when settings differ from original", () => {
      useSettingsStore.setState({
        basicInfo: { title: "T", genre: null, subGenre: null, createdAt: null },
        originalBasicInfo: { title: "T", genre: null, subGenre: null, createdAt: null },
        settings: { budgetLimitUsd: 99 },
        originalSettings: {},
      });
      expect(useSettingsStore.getState().isDirty()).toBe(true);
    });
  });

  describe("reset()", () => {
    it("resets all state to defaults", async () => {
      useSettingsStore.setState({
        basicInfo: { title: "Something", genre: "玄幻", subGenre: null, createdAt: null },
        settings: { budgetLimitUsd: 100 },
        error: "Some error",
        saveSuccess: true,
      });

      useSettingsStore.getState().reset();

      const s = useSettingsStore.getState();
      expect(s.basicInfo.title).toBe("");
      expect(s.settings).toEqual({});
      expect(s.error).toBeNull();
      expect(s.saveSuccess).toBe(false);
      expect(s.isLoading).toBe(false);
    });
  });
});
