import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { OutlineEditor } from "@/components/settings/outline-editor";

const mockUseOutline = vi.fn();

vi.mock("@/hooks/use-outline", () => ({
  useOutline: (...args: unknown[]) => mockUseOutline(...args),
}));

const demoOutline = {
  id: "o1",
  projectId: "p1",
  synopsis: "这是一个关于修仙的故事",
  structureType: "four-act",
  themes: ["逆天改命", "成长"],
  createdAt: "2025-01-01",
  updatedAt: "2025-01-01",
};

const demoArcs = [
  {
    id: "a1",
    projectId: "p1",
    arcIndex: 1,
    title: "废物觉醒",
    description: "第一弧段",
    startChapter: 1,
    endChapter: 30,
    detailedPlan: "详细计划",
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
  },
  {
    id: "a2",
    projectId: "p1",
    arcIndex: 2,
    title: "秘境历练",
    description: "第二弧段",
    startChapter: 31,
    endChapter: 60,
    detailedPlan: "",
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
  },
];

describe("OutlineEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockUseOutline.mockReturnValue({
      outline: null,
      arcs: [],
      loading: true,
      error: null,
      updateOutline: vi.fn(),
      createArc: vi.fn(),
      updateArc: vi.fn(),
      deleteArc: vi.fn(),
    });
    render(<OutlineEditor projectId="p1" />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("renders synopsis", () => {
    mockUseOutline.mockReturnValue({
      outline: demoOutline,
      arcs: demoArcs,
      loading: false,
      error: null,
      updateOutline: vi.fn(),
      createArc: vi.fn(),
      updateArc: vi.fn(),
      deleteArc: vi.fn(),
    });
    render(<OutlineEditor projectId="p1" />);
    expect(screen.getByText("故事梗概")).toBeDefined();
    expect(screen.getByText("这是一个关于修仙的故事")).toBeDefined();
  });

  it("renders theme badges", () => {
    mockUseOutline.mockReturnValue({
      outline: demoOutline,
      arcs: demoArcs,
      loading: false,
      error: null,
      updateOutline: vi.fn(),
      createArc: vi.fn(),
      updateArc: vi.fn(),
      deleteArc: vi.fn(),
    });
    render(<OutlineEditor projectId="p1" />);
    expect(screen.getByText("逆天改命")).toBeDefined();
    expect(screen.getByText("成长")).toBeDefined();
  });

  it("renders arc list", () => {
    mockUseOutline.mockReturnValue({
      outline: demoOutline,
      arcs: demoArcs,
      loading: false,
      error: null,
      updateOutline: vi.fn(),
      createArc: vi.fn(),
      updateArc: vi.fn(),
      deleteArc: vi.fn(),
    });
    render(<OutlineEditor projectId="p1" />);
    expect(screen.getByText("废物觉醒")).toBeDefined();
    expect(screen.getByText("秘境历练")).toBeDefined();
  });

  it("shows empty arc state", () => {
    mockUseOutline.mockReturnValue({
      outline: demoOutline,
      arcs: [],
      loading: false,
      error: null,
      updateOutline: vi.fn(),
      createArc: vi.fn(),
      updateArc: vi.fn(),
      deleteArc: vi.fn(),
    });
    render(<OutlineEditor projectId="p1" />);
    expect(screen.getByText("暂无弧段")).toBeDefined();
  });

  it("shows edit button for synopsis", () => {
    mockUseOutline.mockReturnValue({
      outline: demoOutline,
      arcs: [],
      loading: false,
      error: null,
      updateOutline: vi.fn(),
      createArc: vi.fn(),
      updateArc: vi.fn(),
      deleteArc: vi.fn(),
    });
    render(<OutlineEditor projectId="p1" />);
    expect(screen.getByText("编辑")).toBeDefined();
  });
});
