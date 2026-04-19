import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AnalysisTab from "@/components/panel/tabs/AnalysisTab";
import { usePanelStore } from "@/stores/panel-store";

vi.mock("@/stores/panel-store", () => ({
  usePanelStore: vi.fn(),
}));

vi.mock("next/dynamic", () => ({
  default: () => {
    return function MockDynamic({ analysis }: any) {
      return analysis ? (
        <div data-testid="analysis-charts">
          Radar: {analysis.radarData?.length ?? 0}, Trend: {analysis.trendData?.length ?? 0}
        </div>
      ) : null;
    };
  },
}));

vi.mock("@/components/panel/shared/TabEmptyState", () => ({
  TabEmptyState: ({ text }: any) => <div data-testid="empty-state">{text}</div>,
}));

vi.mock("@/components/panel/shared/CollapsibleSection", () => ({
  CollapsibleSection: ({ title, children }: any) => (
    <div data-testid="collapsible-section">
      <div data-testid="section-title">{title}</div>
      {children}
    </div>
  ),
}));

vi.mock("@/components/chat/MarkdownRenderer", () => ({
  MarkdownRenderer: ({ content }: any) => <div data-testid="markdown">{content}</div>,
}));

describe("AnalysisTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no data", () => {
    (usePanelStore as any).mockImplementation((selector: any) => {
      return selector({ analysis: null, externalAnalysis: null });
    });
    render(<AnalysisTab projectId="proj-1" />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("renders internal analysis view with score", () => {
    const mockAnalysis = {
      radarData: [{ dimension: "情节张力", score: 80 }],
      trendData: [],
      commentary: "整体表现不错",
      overallScore: 82,
    };

    (usePanelStore as any).mockImplementation((selector: any) => {
      return selector({ analysis: mockAnalysis, externalAnalysis: null });
    });

    render(<AnalysisTab projectId="proj-1" />);
    expect(screen.getByText("82")).toBeInTheDocument();
    expect(screen.getByText("综合评分")).toBeInTheDocument();
  });

  it("switches to external analysis view", () => {
    const mockExternal = {
      reports: [
        { id: "rpt-1", workTitle: "三体", topic: "硬科幻叙事", date: "2026-01-15", content: "分析内容" },
      ],
    };

    (usePanelStore as any).mockImplementation((selector: any) => {
      return selector({ analysis: null, externalAnalysis: mockExternal });
    });

    render(<AnalysisTab projectId="proj-1" />);
    fireEvent.click(screen.getByText("参考作品"));
    expect(screen.getByText("三体")).toBeInTheDocument();
    expect(screen.getByText("硬科幻叙事")).toBeInTheDocument();
  });

  it("expands external report on click", () => {
    const mockExternal = {
      reports: [
        { id: "rpt-1", workTitle: "三体", topic: "硬科幻叙事", date: "2026-01-15", content: "详细分析报告内容" },
      ],
    };

    (usePanelStore as any).mockImplementation((selector: any) => {
      return selector({ analysis: null, externalAnalysis: mockExternal });
    });

    render(<AnalysisTab projectId="proj-1" />);
    fireEvent.click(screen.getByText("参考作品"));
    fireEvent.click(screen.getByText("三体"));
    expect(screen.getByTestId("markdown")).toHaveTextContent("详细分析报告内容");
  });
});
