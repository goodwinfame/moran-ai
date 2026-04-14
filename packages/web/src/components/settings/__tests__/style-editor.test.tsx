import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { StyleEditor } from "@/components/settings/style-editor";

const mockUseStyles = vi.fn();
const mockUseStyleDetail = vi.fn();

vi.mock("@/hooks/use-styles", () => ({
  useStyles: (...args: unknown[]) => mockUseStyles(...args),
  useStyleDetail: (...args: unknown[]) => mockUseStyleDetail(...args),
}));

const demoStyles = [
  {
    styleId: "yunmo",
    displayName: "执笔·云墨",
    genre: "通用",
    description: "默认风格",
    source: "builtin" as const,
    forkedFrom: null,
  },
  {
    styleId: "jianxin",
    displayName: "执笔·剑心",
    genre: "仙侠/武侠",
    description: "硬派仙侠",
    source: "builtin" as const,
    forkedFrom: null,
  },
  {
    styleId: "user-123",
    displayName: "我的风格",
    genre: "都市",
    description: "自定义",
    source: "user" as const,
    forkedFrom: null,
  },
];

describe("StyleEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseStyleDetail.mockReturnValue({
      style: null,
      loading: false,
      error: null,
      forkStyle: vi.fn(),
      createStyle: vi.fn(),
      updateStyle: vi.fn(),
      deleteStyle: vi.fn(),
    });
  });

  it("shows loading state", () => {
    mockUseStyles.mockReturnValue({
      styles: [],
      loading: true,
      error: null,
      refetch: vi.fn(),
    });
    render(<StyleEditor projectId="p1" />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("shows empty state", () => {
    mockUseStyles.mockReturnValue({
      styles: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<StyleEditor projectId="p1" />);
    expect(screen.getByText("暂无风格")).toBeDefined();
  });

  it("renders style list with source badges", () => {
    mockUseStyles.mockReturnValue({
      styles: demoStyles,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<StyleEditor projectId="p1" />);
    expect(screen.getByText("执笔·云墨")).toBeDefined();
    expect(screen.getByText("执笔·剑心")).toBeDefined();
    expect(screen.getByText("我的风格")).toBeDefined();
  });

  it("shows builtin and user badges", () => {
    mockUseStyles.mockReturnValue({
      styles: demoStyles,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<StyleEditor projectId="p1" />);
    // Should have 2 "内置" badges and at least 1 "自定义" badge
    const badges = screen.getAllByText("内置");
    expect(badges).toHaveLength(2);
    // "自定义" appears both as a source badge and as the create button
    const customTexts = screen.getAllByText("自定义");
    expect(customTexts.length).toBeGreaterThanOrEqual(1);
  });

  it("shows create button", () => {
    mockUseStyles.mockReturnValue({
      styles: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<StyleEditor projectId="p1" />);
    expect(screen.getByText("自定义")).toBeDefined();
  });

  it("renders header with palette icon text", () => {
    mockUseStyles.mockReturnValue({
      styles: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<StyleEditor projectId="p1" />);
    expect(screen.getByText("风格列表")).toBeDefined();
  });
});
