import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocationTree } from "@/components/visualize/location-tree";

const mockUseLocations = vi.fn();

vi.mock("@/hooks/use-locations", () => ({
  useLocations: (...args: unknown[]) => mockUseLocations(...args),
}));

// Mock d3 dynamic import
vi.mock("d3", () => ({
  select: () => ({
    selectAll: () => ({ remove: vi.fn() }),
    append: () => ({
      attr: function() { return this; },
      selectAll: () => ({
        data: () => ({
          enter: () => ({
            append: () => ({
              attr: function() { return this; },
              text: function() { return this; },
            }),
          }),
        }),
      }),
    }),
    call: () => ({}),
  }),
  hierarchy: () => ({}),
  tree: () => ({ size: () => () => ({ links: () => [], descendants: () => [] }) }),
  linkHorizontal: () => ({ x: () => ({ y: () => vi.fn() }) }),
  zoom: () => ({ scaleExtent: () => ({ on: () => vi.fn() }) }),
}));

describe("LocationTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows prompt when no projectId", () => {
    mockUseLocations.mockReturnValue({
      tree: [], flat: [], loading: false, error: null, refetch: vi.fn(),
    });
    render(<LocationTree projectId={null} />);
    expect(screen.getByText("请先选择项目")).toBeDefined();
  });

  it("shows loading state", () => {
    mockUseLocations.mockReturnValue({
      tree: [], flat: [], loading: true, error: null, refetch: vi.fn(),
    });
    render(<LocationTree projectId="p1" />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("shows error state", () => {
    mockUseLocations.mockReturnValue({
      tree: [], flat: [], loading: false, error: "加载失败", refetch: vi.fn(),
    });
    render(<LocationTree projectId="p1" />);
    expect(screen.getByText("加载失败")).toBeDefined();
  });

  it("shows empty state when no data", () => {
    mockUseLocations.mockReturnValue({
      tree: [], flat: [], loading: false, error: null, refetch: vi.fn(),
    });
    render(<LocationTree projectId="p1" />);
    expect(screen.getByText("暂无地点数据")).toBeDefined();
  });

  it("renders header with count when data present", () => {
    mockUseLocations.mockReturnValue({
      tree: [{ id: "r1", name: "天玄大陆", type: "realm", description: "", children: [] }],
      flat: [
        { id: "r1", name: "天玄大陆", parentId: null, type: "realm", description: "", attributes: {} },
        { id: "r2", name: "苍云山脉", parentId: "r1", type: "region", description: "", attributes: {} },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<LocationTree projectId="p1" />);
    expect(screen.getByText("地点层级树")).toBeDefined();
    expect(screen.getByText("2 地点")).toBeDefined();
  });

  it("renders legend with type labels", () => {
    mockUseLocations.mockReturnValue({
      tree: [{ id: "r1", name: "X", type: "realm", description: "", children: [] }],
      flat: [{ id: "r1", name: "X", parentId: null, type: "realm", description: "", attributes: {} }],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<LocationTree projectId="p1" />);
    expect(screen.getByText("界")).toBeDefined();
    expect(screen.getByText("域")).toBeDefined();
    expect(screen.getByText("城")).toBeDefined();
    expect(screen.getByText("建筑")).toBeDefined();
  });
});
