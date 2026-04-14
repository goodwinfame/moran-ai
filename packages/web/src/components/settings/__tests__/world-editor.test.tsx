import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorldEditor } from "@/components/settings/world-editor";

// Mock the hooks
const mockUseWorldSettings = vi.fn();

vi.mock("@/hooks/use-world-settings", () => ({
  useWorldSettings: (...args: unknown[]) => mockUseWorldSettings(...args),
}));

describe("WorldEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockUseWorldSettings.mockReturnValue({
      settings: [],
      loading: true,
      createSetting: vi.fn(),
      updateSetting: vi.fn(),
      deleteSetting: vi.fn(),
    });
    render(<WorldEditor projectId="p1" />);
    // The Loader2 spinner should be present
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("shows empty state when no settings", () => {
    mockUseWorldSettings.mockReturnValue({
      settings: [],
      loading: false,
      createSetting: vi.fn(),
      updateSetting: vi.fn(),
      deleteSetting: vi.fn(),
    });
    render(<WorldEditor projectId="p1" />);
    expect(screen.getByText("暂无世界设定")).toBeDefined();
  });

  it("renders settings list", () => {
    mockUseWorldSettings.mockReturnValue({
      settings: [
        { id: "s1", section: "rules", name: "基础法则", content: "内容" },
        { id: "s2", section: "subsystem:power", name: "修炼体系", content: "体系内容" },
      ],
      loading: false,
      createSetting: vi.fn(),
      updateSetting: vi.fn(),
      deleteSetting: vi.fn(),
    });
    render(<WorldEditor projectId="p1" />);
    expect(screen.getAllByText("基础法则").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("修炼体系").length).toBeGreaterThanOrEqual(1);
  });

  it("shows header with add button", () => {
    mockUseWorldSettings.mockReturnValue({
      settings: [],
      loading: false,
      createSetting: vi.fn(),
      updateSetting: vi.fn(),
      deleteSetting: vi.fn(),
    });
    render(<WorldEditor projectId="p1" />);
    expect(screen.getByText("子系统列表")).toBeDefined();
    expect(screen.getByText("新增")).toBeDefined();
  });
});
