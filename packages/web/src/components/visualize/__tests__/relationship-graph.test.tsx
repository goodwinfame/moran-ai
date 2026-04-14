import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RelationshipGraph } from "@/components/visualize/relationship-graph";

const mockUseCharacterGraph = vi.fn();

vi.mock("@/hooks/use-characters", () => ({
  useCharacterGraph: (...args: unknown[]) => mockUseCharacterGraph(...args),
}));

// Mock cytoscape dynamic import
vi.mock("cytoscape", () => ({
  default: () => ({ destroy: vi.fn() }),
}));

describe("RelationshipGraph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows prompt when no projectId", () => {
    mockUseCharacterGraph.mockReturnValue({
      nodes: [], edges: [], loading: false, error: null, refetch: vi.fn(),
    });
    render(<RelationshipGraph projectId={null} />);
    expect(screen.getByText("请先选择项目")).toBeDefined();
  });

  it("shows loading state", () => {
    mockUseCharacterGraph.mockReturnValue({
      nodes: [], edges: [], loading: true, error: null, refetch: vi.fn(),
    });
    render(<RelationshipGraph projectId="p1" />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("shows error state", () => {
    mockUseCharacterGraph.mockReturnValue({
      nodes: [], edges: [], loading: false, error: "网络错误", refetch: vi.fn(),
    });
    render(<RelationshipGraph projectId="p1" />);
    expect(screen.getByText("网络错误")).toBeDefined();
  });

  it("shows empty state when no data", () => {
    mockUseCharacterGraph.mockReturnValue({
      nodes: [], edges: [], loading: false, error: null, refetch: vi.fn(),
    });
    render(<RelationshipGraph projectId="p1" />);
    expect(screen.getByText("暂无角色数据")).toBeDefined();
  });

  it("renders header with counts when data present", () => {
    mockUseCharacterGraph.mockReturnValue({
      nodes: [
        { id: "n1", label: "主角", role: "protagonist", color: "#e53e3e" },
        { id: "n2", label: "反派", role: "antagonist", color: "#805ad5" },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2", label: "对手", description: "" },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<RelationshipGraph projectId="p1" />);
    expect(screen.getByText("人物关系图")).toBeDefined();
    expect(screen.getByText("2 角色")).toBeDefined();
    expect(screen.getByText("1 关系")).toBeDefined();
  });

  it("renders legend with role labels", () => {
    mockUseCharacterGraph.mockReturnValue({
      nodes: [{ id: "n1", label: "X", role: "protagonist", color: "#e53e3e" }],
      edges: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<RelationshipGraph projectId="p1" />);
    expect(screen.getByText("主角")).toBeDefined();
    expect(screen.getByText("反派")).toBeDefined();
    expect(screen.getByText("配角")).toBeDefined();
    expect(screen.getByText("龙套")).toBeDefined();
  });
});
