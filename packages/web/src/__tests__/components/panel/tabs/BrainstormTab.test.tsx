import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrainstormTab } from "@/components/panel/tabs/BrainstormTab";
import { usePanelStore } from "@/stores/panel-store";
import { useChatStore } from "@/stores/chat-store";

vi.mock("@/stores/panel-store", () => ({
  usePanelStore: vi.fn(),
}));

vi.mock("@/stores/chat-store", () => ({
  useChatStore: {
    getState: vi.fn(),
  },
}));

vi.mock("@/components/panel/shared/CollapsibleSection", () => ({
  CollapsibleSection: ({ title, children }: any) => (
    <div data-testid="collapsible-section">
      <div data-testid="section-title">{title}</div>
      {children}
    </div>
  ),
}));

vi.mock("@/components/panel/shared/TabEmptyState", () => ({
  TabEmptyState: ({ text }: any) => <div data-testid="empty-state">{text}</div>,
}));

vi.mock("@/components/ui/icon", () => ({
  Icon: ({ name }: any) => <span data-testid={`icon-${name}`} />,
}));

describe("BrainstormTab", () => {
  const mockSendMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useChatStore.getState as any).mockReturnValue({
      sendMessage: mockSendMessage,
    });
  });

  it("renders empty state when data is null", () => {
    (usePanelStore as any).mockReturnValue(null);
    render(<BrainstormTab projectId="proj-1" />);
    
    expect(screen.getByTestId("empty-state")).toHaveTextContent("还没有脑暴记录。在左侧告诉墨衡你的创作灵感...");
  });

  it("renders diverge phase and handles star click", () => {
    const mockData = {
      diverge: [
        { id: "1", title: "Direction 1", starred: false },
        { id: "2", title: "Direction 2", starred: true },
      ],
      converge: null,
      crystal: null,
    };
    (usePanelStore as any).mockReturnValue(mockData);

    render(<BrainstormTab projectId="proj-1" />);

    expect(screen.getByText("发散阶段")).toBeInTheDocument();
    expect(screen.getByText("Direction 1")).toBeInTheDocument();
    expect(screen.getByText("Direction 2")).toBeInTheDocument();

    const starButtons = screen.getAllByRole("button", { name: /喜欢方向/ });
    expect(starButtons[0]).toBeDefined();
    fireEvent.click(starButtons[0]!);

    expect(mockSendMessage).toHaveBeenCalledWith("proj-1", "我喜欢方向：Direction 1");
  });

  it("renders converge and crystal phases", () => {
    const mockData = {
      diverge: [],
      converge: {
        selectedDirections: ["Dir 1"],
        genre: "Sci-Fi",
        coreConflict: "Man vs Machine",
        targetAudience: "Young Adult",
      },
      crystal: {
        title: "The Matrix",
        type: "Novel",
        concept: "Virtual Reality",
        sellingPoints: "Action, Philosophy",
        wordTarget: "100k",
        oneLiner: "He is the one.",
      },
    };
    (usePanelStore as any).mockReturnValue(mockData);

    render(<BrainstormTab projectId="proj-1" />);

    expect(screen.getByText("聚焦阶段")).toBeInTheDocument();
    expect(screen.getByText("Dir 1")).toBeInTheDocument();
    expect(screen.getByText("Sci-Fi")).toBeInTheDocument();
    
    expect(screen.getByText("✨ 结晶方案")).toBeInTheDocument();
    expect(screen.getByText("The Matrix")).toBeInTheDocument();
    expect(screen.getByText('"He is the one."')).toBeInTheDocument();
  });
});
