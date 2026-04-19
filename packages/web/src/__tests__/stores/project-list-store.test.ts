/**
 * Tests for project-list-store
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useProjectListStore, type ProjectItem } from "@/stores/project-list-store";

// ── Mock @/lib/api ─────────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from "@/lib/api";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<ProjectItem> = {}): ProjectItem {
  return {
    id: "proj-1",
    title: "测试项目",
    genre: "赛博朋克",
    status: "brainstorm",
    currentChapter: 0,
    chapterCount: 30,
    totalWordCount: 0,
    updatedAt: "2026-01-01T00:00:00.000Z",
    isPinned: false,
    ...overrides,
  };
}

function resetStore() {
  useProjectListStore.setState({
    projects: [],
    isLoading: false,
    isSending: false,
    inlineMessages: [],
  });
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("useProjectListStore", () => {
  describe("initial state", () => {
    it("starts with empty projects", () => {
      const { projects } = useProjectListStore.getState();
      expect(projects).toEqual([]);
    });

    it("starts with isLoading=false", () => {
      expect(useProjectListStore.getState().isLoading).toBe(false);
    });

    it("starts with isSending=false", () => {
      expect(useProjectListStore.getState().isSending).toBe(false);
    });

    it("starts with empty inlineMessages", () => {
      expect(useProjectListStore.getState().inlineMessages).toEqual([]);
    });
  });

  describe("fetchProjects()", () => {
    it("sets projects from API response and clears isLoading", async () => {
      const proj1 = makeProject({ id: "a", updatedAt: "2026-01-02T00:00:00.000Z" });
      const proj2 = makeProject({ id: "b", updatedAt: "2026-01-01T00:00:00.000Z" });
      vi.mocked(api.get).mockResolvedValueOnce({ ok: true, data: [proj1, proj2] });

      await useProjectListStore.getState().fetchProjects();

      const { projects, isLoading } = useProjectListStore.getState();
      expect(isLoading).toBe(false);
      expect(projects).toHaveLength(2);
      expect(projects[0]?.id).toBe("a"); // newer first
      expect(projects[1]?.id).toBe("b");
    });

    it("sorts pinned projects first", async () => {
      const unpinned = makeProject({ id: "unpinned", isPinned: false, updatedAt: "2026-01-02T00:00:00.000Z" });
      const pinned = makeProject({ id: "pinned", isPinned: true, updatedAt: "2026-01-01T00:00:00.000Z" });
      vi.mocked(api.get).mockResolvedValueOnce({ ok: true, data: [unpinned, pinned] });

      await useProjectListStore.getState().fetchProjects();

      const { projects } = useProjectListStore.getState();
      expect(projects[0]?.id).toBe("pinned");
      expect(projects[1]?.id).toBe("unpinned");
    });

    it("sets isLoading=true during fetch, false after", async () => {
      let resolveIt!: (v: unknown) => void;
      const promise = new Promise((res) => { resolveIt = res; });
      vi.mocked(api.get).mockReturnValueOnce(promise as ReturnType<typeof api.get>);

      const fetchPromise = useProjectListStore.getState().fetchProjects();
      expect(useProjectListStore.getState().isLoading).toBe(true);

      resolveIt({ ok: true, data: [] });
      await fetchPromise;
      expect(useProjectListStore.getState().isLoading).toBe(false);
    });

    it("clears isLoading on error without throwing", async () => {
      vi.mocked(api.get).mockRejectedValueOnce(new Error("network error"));

      await expect(
        useProjectListStore.getState().fetchProjects()
      ).resolves.toBeUndefined();

      expect(useProjectListStore.getState().isLoading).toBe(false);
    });
  });

  describe("createProject()", () => {
    it("returns the new project id", async () => {
      const newProj = makeProject({ id: "new-id", title: "新项目" });
      vi.mocked(api.post).mockResolvedValueOnce({ ok: true, data: newProj });

      const id = await useProjectListStore.getState().createProject("新项目", "修仙");
      expect(id).toBe("new-id");
    });

    it("adds the new project to the store", async () => {
      const newProj = makeProject({ id: "new-id" });
      vi.mocked(api.post).mockResolvedValueOnce({ ok: true, data: newProj });

      await useProjectListStore.getState().createProject("新项目");
      expect(useProjectListStore.getState().projects).toHaveLength(1);
      expect(useProjectListStore.getState().projects[0]?.id).toBe("new-id");
    });

    it("posts to /api/projects with title and genre", async () => {
      const newProj = makeProject({ id: "x" });
      vi.mocked(api.post).mockResolvedValueOnce({ ok: true, data: newProj });

      await useProjectListStore.getState().createProject("Title", "Genre");
      expect(api.post).toHaveBeenCalledWith("/api/projects", { title: "Title", genre: "Genre" });
    });

    it("returns empty string on error", async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error("fail"));

      const id = await useProjectListStore.getState().createProject("错误项目");
      expect(id).toBe("");
    });
  });

  describe("deleteProject()", () => {
    it("removes the project from state", async () => {
      useProjectListStore.setState({ projects: [makeProject({ id: "del-me" })] });
      vi.mocked(api.delete).mockResolvedValueOnce({ ok: true });

      await useProjectListStore.getState().deleteProject("del-me");
      expect(useProjectListStore.getState().projects).toHaveLength(0);
    });

    it("calls DELETE /api/projects/:id", async () => {
      useProjectListStore.setState({ projects: [makeProject({ id: "proj-x" })] });
      vi.mocked(api.delete).mockResolvedValueOnce({ ok: true });

      await useProjectListStore.getState().deleteProject("proj-x");
      expect(api.delete).toHaveBeenCalledWith("/api/projects/proj-x");
    });

    it("does not throw on error", async () => {
      useProjectListStore.setState({ projects: [makeProject({ id: "bad" })] });
      vi.mocked(api.delete).mockRejectedValueOnce(new Error("fail"));

      await expect(
        useProjectListStore.getState().deleteProject("bad")
      ).resolves.toBeUndefined();
    });
  });

  describe("renameProject()", () => {
    it("updates title in state", async () => {
      const proj = makeProject({ id: "r1", title: "Old Title" });
      useProjectListStore.setState({ projects: [proj] });
      const updated = { ...proj, title: "New Title" };
      vi.mocked(api.put).mockResolvedValueOnce({ ok: true, data: updated });

      await useProjectListStore.getState().renameProject("r1", "New Title");
      expect(useProjectListStore.getState().projects[0]?.title).toBe("New Title");
    });

    it("calls PUT /api/projects/:id with new title", async () => {
      const proj = makeProject({ id: "r2" });
      useProjectListStore.setState({ projects: [proj] });
      vi.mocked(api.put).mockResolvedValueOnce({ ok: true, data: { ...proj, title: "X" } });

      await useProjectListStore.getState().renameProject("r2", "X");
      expect(api.put).toHaveBeenCalledWith("/api/projects/r2", { title: "X" });
    });

    it("does not throw on error", async () => {
      useProjectListStore.setState({ projects: [makeProject({ id: "r3" })] });
      vi.mocked(api.put).mockRejectedValueOnce(new Error("fail"));

      await expect(
        useProjectListStore.getState().renameProject("r3", "New")
      ).resolves.toBeUndefined();
    });
  });

  describe("pinProject()", () => {
    it("toggles isPinned from false to true", async () => {
      const proj = makeProject({ id: "p1", isPinned: false });
      useProjectListStore.setState({ projects: [proj] });
      const toggled = { ...proj, isPinned: true };
      vi.mocked(api.put).mockResolvedValueOnce({ ok: true, data: toggled });

      await useProjectListStore.getState().pinProject("p1");
      expect(useProjectListStore.getState().projects[0]?.isPinned).toBe(true);
    });

    it("toggles isPinned from true to false", async () => {
      const proj = makeProject({ id: "p2", isPinned: true });
      useProjectListStore.setState({ projects: [proj] });
      const toggled = { ...proj, isPinned: false };
      vi.mocked(api.put).mockResolvedValueOnce({ ok: true, data: toggled });

      await useProjectListStore.getState().pinProject("p2");
      expect(useProjectListStore.getState().projects[0]?.isPinned).toBe(false);
    });

    it("sends the toggled isPinned value in request body", async () => {
      const proj = makeProject({ id: "p3", isPinned: false });
      useProjectListStore.setState({ projects: [proj] });
      vi.mocked(api.put).mockResolvedValueOnce({ ok: true, data: { ...proj, isPinned: true } });

      await useProjectListStore.getState().pinProject("p3");
      expect(api.put).toHaveBeenCalledWith("/api/projects/p3", { isPinned: true });
    });

    it("re-sorts so pinned items come first", async () => {
      const a = makeProject({ id: "a", isPinned: false, updatedAt: "2026-01-03T00:00:00.000Z" });
      const b = makeProject({ id: "b", isPinned: false, updatedAt: "2026-01-02T00:00:00.000Z" });
      useProjectListStore.setState({ projects: [a, b] });
      vi.mocked(api.put).mockResolvedValueOnce({ ok: true, data: { ...b, isPinned: true } });

      await useProjectListStore.getState().pinProject("b");
      const { projects } = useProjectListStore.getState();
      expect(projects[0]?.id).toBe("b"); // now pinned → first
    });

    it("is a no-op for unknown id", async () => {
      await useProjectListStore.getState().pinProject("ghost");
      expect(api.put).not.toHaveBeenCalled();
    });
  });

  describe("archiveProject()", () => {
    it("removes project from local list", async () => {
      const proj = makeProject({ id: "arch-1" });
      useProjectListStore.setState({ projects: [proj] });
      vi.mocked(api.put).mockResolvedValueOnce({ ok: true, data: { ...proj, status: "archived" } });

      await useProjectListStore.getState().archiveProject("arch-1");
      expect(useProjectListStore.getState().projects).toHaveLength(0);
    });

    it("sends status=archived in request body", async () => {
      const proj = makeProject({ id: "arch-2" });
      useProjectListStore.setState({ projects: [proj] });
      vi.mocked(api.put).mockResolvedValueOnce({ ok: true, data: proj });

      await useProjectListStore.getState().archiveProject("arch-2");
      expect(api.put).toHaveBeenCalledWith("/api/projects/arch-2", { status: "archived" });
    });

    it("does not throw on error", async () => {
      useProjectListStore.setState({ projects: [makeProject({ id: "arch-3" })] });
      vi.mocked(api.put).mockRejectedValueOnce(new Error("fail"));

      await expect(
        useProjectListStore.getState().archiveProject("arch-3")
      ).resolves.toBeUndefined();
    });
  });

  describe("sendInlineMessage()", () => {
    it("adds user message immediately before API call", async () => {
      let resolveIt!: (v: unknown) => void;
      const promise = new Promise((res) => { resolveIt = res; });
      vi.mocked(api.post).mockReturnValueOnce(promise as ReturnType<typeof api.post>);

      const sendPromise = useProjectListStore.getState().sendInlineMessage("你好");
      // Check that user message was added before awaiting
      expect(useProjectListStore.getState().inlineMessages[0]).toEqual({
        role: "user",
        content: "你好",
      });
      expect(useProjectListStore.getState().isSending).toBe(true);

      resolveIt({ ok: true, data: { text: "你好！" } });
      await sendPromise;
    });

    it("adds assistant reply after API returns", async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        ok: true,
        data: { text: "我是墨衡" },
      });

      await useProjectListStore.getState().sendInlineMessage("你好");

      const { inlineMessages } = useProjectListStore.getState();
      expect(inlineMessages).toHaveLength(2);
      expect(inlineMessages[1]).toEqual({ role: "assistant", content: "我是墨衡" });
    });

    it("returns the InlineReply from the API", async () => {
      const reply = { text: "回复内容", action: { type: "navigate" as const, projectId: "proj-1" } };
      vi.mocked(api.post).mockResolvedValueOnce({ ok: true, data: reply });

      const result = await useProjectListStore.getState().sendInlineMessage("继续写");
      expect(result).toEqual(reply);
    });

    it("sets isSending=false after completion", async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ ok: true, data: { text: "ok" } });

      await useProjectListStore.getState().sendInlineMessage("msg");
      expect(useProjectListStore.getState().isSending).toBe(false);
    });

    it("trims messages to max 6 (3 rounds) when exceeded", async () => {
      // Pre-fill with 6 messages (3 rounds)
      useProjectListStore.setState({
        inlineMessages: [
          { role: "user", content: "r1q" },
          { role: "assistant", content: "r1a" },
          { role: "user", content: "r2q" },
          { role: "assistant", content: "r2a" },
          { role: "user", content: "r3q" },
          { role: "assistant", content: "r3a" },
        ],
      });
      vi.mocked(api.post).mockResolvedValueOnce({ ok: true, data: { text: "r4a" } });

      await useProjectListStore.getState().sendInlineMessage("r4q");

      const { inlineMessages } = useProjectListStore.getState();
      // Should have at most 6 messages (oldest pair trimmed)
      expect(inlineMessages.length).toBeLessThanOrEqual(6);
      // Oldest pair (r1q/r1a) should be gone
      expect(inlineMessages.some((m) => m.content === "r1q")).toBe(false);
      expect(inlineMessages.some((m) => m.content === "r1a")).toBe(false);
      // Newest messages should be present
      expect(inlineMessages.some((m) => m.content === "r4q")).toBe(true);
      expect(inlineMessages.some((m) => m.content === "r4a")).toBe(true);
    });

    it("adds error message and returns null on failure", async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error("network error"));

      const result = await useProjectListStore.getState().sendInlineMessage("hello");
      expect(result).toBeNull();

      const { inlineMessages, isSending } = useProjectListStore.getState();
      expect(isSending).toBe(false);
      const lastMsg = inlineMessages[inlineMessages.length - 1];
      expect(lastMsg?.role).toBe("assistant");
      expect(lastMsg?.content).toContain("网络异常");
    });
  });

  describe("clearInlineMessages()", () => {
    it("resets inlineMessages to empty array", () => {
      useProjectListStore.setState({
        inlineMessages: [
          { role: "user", content: "hi" },
          { role: "assistant", content: "hello" },
        ],
      });

      useProjectListStore.getState().clearInlineMessages();
      expect(useProjectListStore.getState().inlineMessages).toEqual([]);
    });
  });
});
