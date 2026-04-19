/**
 * ProjectSettingsDrawer — Component Tests (Phase 9 rewrite)
 *
 * Tests real data binding via mocked useSettingsStore hook.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as React from "react";

// ── Mock the settings store ───────────────────────────────────────────────────

const mockLoadSettings = vi.fn();
const mockUpdateSettings = vi.fn();
const mockReset = vi.fn();

const defaultStoreState = {
  basicInfo: { title: "My Novel", genre: "仙侠", subGenre: "修仙", createdAt: "2026-01-01T00:00:00Z" },
  settings: {
    writerStyle: { styleName: "剑心" },
    modelOverrides: { mingjing: "claude-opus" },
    budgetLimitUsd: 50,
    budgetBehavior: "pause" as const,
    writingParams: { chapterWordCount: 3000, reviewThreshold: 80 },
  },
  isLoading: false,
  isSaving: false,
  error: null,
  saveSuccess: false,
  loadSettings: mockLoadSettings,
  updateSettings: mockUpdateSettings,
  reset: mockReset,
  isDirty: () => false,
  clearMessages: vi.fn(),
};

let storeState = { ...defaultStoreState };

vi.mock("@/stores/settings-store", () => ({
  useSettingsStore: (selector?: (s: typeof storeState) => unknown) => {
    if (typeof selector === "function") return selector(storeState);
    return storeState;
  },
}));

// Also mock the api for delete
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { ProjectSettingsDrawer } from "../../../components/settings/ProjectSettingsDrawer";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderDrawer(
  props: Partial<{ open: boolean; onClose: () => void; onProjectDeleted: () => void }> = {},
) {
  const onClose = props.onClose ?? vi.fn();
  return render(
    <ProjectSettingsDrawer
      projectId="proj-1"
      open={props.open ?? true}
      onClose={onClose}
      onProjectDeleted={props.onProjectDeleted}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  storeState = { ...defaultStoreState };
  mockUpdateSettings.mockResolvedValue(true);
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("ProjectSettingsDrawer", () => {
  it("renders nothing when closed", () => {
    const { container } = renderDrawer({ open: false });
    expect(container.firstChild).toBeNull();
  });

  it("shows loading state when isLoading is true", () => {
    storeState = { ...defaultStoreState, isLoading: true };
    renderDrawer();
    expect(screen.getByTestId("settings-loading")).toBeDefined();
  });

  it("calls loadSettings on open with correct projectId", () => {
    renderDrawer();
    expect(mockLoadSettings).toHaveBeenCalledWith("proj-1");
  });

  it("renders drawer when open", () => {
    renderDrawer();
    expect(screen.getByTestId("settings-drawer")).toBeDefined();
    expect(screen.getByText("项目设置")).toBeDefined();
  });

  it("shows 6 sections from store data", () => {
    renderDrawer();
    expect(screen.getByText("基本信息")).toBeDefined();
    expect(screen.getByText("写作风格")).toBeDefined();
    expect(screen.getByText("模型配置")).toBeDefined();
    expect(screen.getByText("成本预算")).toBeDefined();
    expect(screen.getByText("写作参数")).toBeDefined();
    expect(screen.getByText("危险操作")).toBeDefined();
  });

  it("displays title from store in the title input", () => {
    renderDrawer();
    const titleInput = screen.getByTestId("settings-title-input") as HTMLInputElement;
    expect(titleInput.value).toBe("My Novel");
  });

  it("close button calls onClose", () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });
    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("Escape key calls onClose", () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("clicking backdrop calls onClose", () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });
    fireEvent.click(screen.getByTestId("settings-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });

  it("save button in 基本信息 calls updateSettings", async () => {
    renderDrawer();
    const saveButtons = screen.getAllByRole("button", { name: "保存" });
    fireEvent.click(saveButtons[0]!);
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        "proj-1",
        expect.objectContaining({ title: "My Novel" }),
      );
    });
  });

  it("delete button shows confirm dialog", () => {
    renderDrawer();
    const deleteBtn = screen.getByTestId("delete-project-btn");
    fireEvent.click(deleteBtn);
    // ConfirmDialog renders with title "删除项目" and a unique confirm label "确认删除"
    expect(screen.getByText("确认删除")).toBeDefined();
    // Multiple elements named "删除项目" exist (button + dialog title) — use getAllByText
    expect(screen.getAllByText("删除项目").length).toBeGreaterThanOrEqual(2);
  });

  it("calls reset when drawer closes", () => {
    const { rerender } = renderDrawer({ open: true });
    rerender(
      <ProjectSettingsDrawer projectId="proj-1" open={false} onClose={vi.fn()} />,
    );
    expect(mockReset).toHaveBeenCalled();
  });

  it("validation: empty title prevents save and shows error", () => {
    renderDrawer();
    const titleInput = screen.getByTestId("settings-title-input");
    fireEvent.change(titleInput, { target: { value: "" } });
    const saveButtons = screen.getAllByRole("button", { name: "保存" });
    fireEvent.click(saveButtons[0]!);
    expect(screen.getByText("项目名称不能为空")).toBeDefined();
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });
});
