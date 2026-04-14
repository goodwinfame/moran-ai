import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CharacterEditor } from "@/components/settings/character-editor";

const mockUseCharacters = vi.fn();

vi.mock("@/hooks/use-characters", () => ({
  useCharacters: (...args: unknown[]) => mockUseCharacters(...args),
}));

const demoCharacters = [
  {
    id: "c1",
    projectId: "p1",
    name: "沈墨尘",
    aliases: ["墨尘"],
    role: "protagonist" as const,
    description: "主角描述",
    personality: "性格",
    background: "背景",
    goals: ["目标1"],
    firstAppearance: 1,
    arc: "角色弧",
    profileContent: null,
    dna: {
      ghost: "幽灵事件",
      wound: "伤痕",
      lie: "谎言",
      want: "表层欲望",
      need: "深层需求",
      arcType: "positive" as const,
      defaultMode: "默认模式",
      stressResponse: "压力反应",
      tell: "小动作",
    },
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
  },
  {
    id: "c2",
    projectId: "p1",
    name: "凌霜",
    aliases: [],
    role: "supporting" as const,
    description: "配角描述",
    personality: "",
    background: "",
    goals: [],
    firstAppearance: 5,
    arc: null,
    profileContent: null,
    dna: null,
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
  },
];

describe("CharacterEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockUseCharacters.mockReturnValue({
      characters: [],
      loading: true,
      error: null,
      createCharacter: vi.fn(),
      updateCharacter: vi.fn(),
      deleteCharacter: vi.fn(),
    });
    render(<CharacterEditor projectId="p1" />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("shows empty state", () => {
    mockUseCharacters.mockReturnValue({
      characters: [],
      loading: false,
      error: null,
      createCharacter: vi.fn(),
      updateCharacter: vi.fn(),
      deleteCharacter: vi.fn(),
    });
    render(<CharacterEditor projectId="p1" />);
    expect(screen.getByText("暂无角色")).toBeDefined();
  });

  it("renders character list with role badges", () => {
    mockUseCharacters.mockReturnValue({
      characters: demoCharacters,
      loading: false,
      error: null,
      createCharacter: vi.fn(),
      updateCharacter: vi.fn(),
      deleteCharacter: vi.fn(),
    });
    render(<CharacterEditor projectId="p1" />);
    expect(screen.getByText("沈墨尘")).toBeDefined();
    expect(screen.getByText("凌霜")).toBeDefined();
    expect(screen.getByText("主角")).toBeDefined();
    expect(screen.getByText("配角")).toBeDefined();
  });

  it("shows DNA badge for characters with DNA", () => {
    mockUseCharacters.mockReturnValue({
      characters: demoCharacters,
      loading: false,
      error: null,
      createCharacter: vi.fn(),
      updateCharacter: vi.fn(),
      deleteCharacter: vi.fn(),
    });
    render(<CharacterEditor projectId="p1" />);
    expect(screen.getByText("DNA")).toBeDefined();
  });

  it("shows header with add button", () => {
    mockUseCharacters.mockReturnValue({
      characters: [],
      loading: false,
      error: null,
      createCharacter: vi.fn(),
      updateCharacter: vi.fn(),
      deleteCharacter: vi.fn(),
    });
    render(<CharacterEditor projectId="p1" />);
    expect(screen.getByText("角色列表")).toBeDefined();
    expect(screen.getByText("新增")).toBeDefined();
  });
});
