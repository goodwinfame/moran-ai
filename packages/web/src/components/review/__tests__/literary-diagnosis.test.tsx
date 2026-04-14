import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LiteraryDiagnosis, type LiteraryDiagnosisData } from "@/components/review/literary-diagnosis";

const mockData: LiteraryDiagnosisData = {
  chapterNumber: 5,
  dimensionDiagnoses: [
    {
      dimension: "narrative_drive",
      label: "\u53D9\u4E8B\u52A8\u529B",
      severity: 7,
      rootCause: "\u89D2\u8272\u7F3A\u4E4F\u5185\u5728\u77DB\u76FE\u9A71\u52A8\u3002",
      improvementDirection: "\u7ED9\u89D2\u8272\u8BBE\u5B9A\u5185\u5728\u77DB\u76FE\u3002",
      evidence: "\u4ED6\u8D70\u51FA\u5C71\u95E8\uFF0C\u7EE7\u7EED\u5411\u524D\u8D70\u53BB\u3002",
    },
    {
      dimension: "emotional_authenticity",
      label: "\u60C5\u611F\u771F\u5B9E\u6027",
      severity: 5,
      rootCause: "\u60C5\u611F\u8868\u8FBE\u4F9D\u8D56\u544A\u8BC9\u800C\u975E\u5C55\u793A\u3002",
      improvementDirection: "\u7528\u5177\u4F53\u884C\u4E3A\u548C\u7EC6\u8282\u4F20\u8FBE\u60C5\u611F\u3002",
    },
    {
      dimension: "pacing_root_cause",
      label: "\u8282\u594F\u95EE\u9898\u6EAF\u6E90",
      severity: 6,
      rootCause: "\u4FE1\u606F\u5BC6\u5EA6\u4E0D\u8DB3\u3002",
      improvementDirection: "\u786E\u4FDD\u6BCF\u4E2A\u573A\u666F\u6709\u5C0F\u51B2\u7A81\u3002",
    },
    {
      dimension: "character_voice",
      label: "\u89D2\u8272\u58F0\u97F3",
      severity: 4,
      rootCause: "\u5BF9\u8BDD\u8FC7\u4E8E\u5E73\u6DE1\u3002",
      improvementDirection: "\u7ED9\u6BCF\u4E2A\u89D2\u8272\u72EC\u7279\u7684\u8BF4\u8BDD\u4E60\u60EF\u3002",
    },
    {
      dimension: "thematic_coherence",
      label: "\u4E3B\u9898\u4E00\u81F4\u6027",
      severity: 3,
      rootCause: "\u573A\u666F\u6CA1\u6709\u63A8\u8FDB\u4E3B\u9898\u3002",
      improvementDirection: "\u5373\u4F7F\u8FC7\u6E21\u573A\u666F\u4E5F\u5448\u73B0\u4E3B\u9898\u3002",
    },
  ],
  coreIssues: [
    {
      title: "\u89D2\u8272\u7F3A\u4E4F\u5185\u5728\u9A71\u52A8\u529B",
      dimensions: ["narrative_drive", "pacing_root_cause"],
      rootCause: "\u89D2\u8272\u50CF\u63D0\u7EBF\u6728\u5076\u3002",
      improvementDirection: "\u8D4B\u4E88\u89D2\u8272WANT vs NEED\u77DB\u76FE\u3002",
      impact: 8,
    },
  ],
  summary: "\u6700\u5927\u95EE\u9898\u662F\u89D2\u8272\u50CF\u63D0\u7EBF\u6728\u5076\uFF0C\u5EFA\u8BAE\u4ECE\u5185\u5728\u77DB\u76FE\u5165\u624B\u3002",
};

describe("LiteraryDiagnosis", () => {
  it("renders chapter header", () => {
    render(<LiteraryDiagnosis data={mockData} />);
    expect(screen.getByText(/\u7B2C5\u7AE0/)).toBeDefined();
    expect(screen.getByText(/\u6587\u5B66\u8BCA\u65AD/)).toBeDefined();
  });

  it("renders summary", () => {
    render(<LiteraryDiagnosis data={mockData} />);
    expect(screen.getByText(/\u6700\u5927\u95EE\u9898\u662F\u89D2\u8272\u50CF\u63D0\u7EBF\u6728\u5076/)).toBeDefined();
  });

  it("renders core issues with title and impact", () => {
    render(<LiteraryDiagnosis data={mockData} />);
    expect(screen.getByText(/\u6838\u5FC3\u95EE\u9898/)).toBeDefined();
    expect(screen.getByText("\u89D2\u8272\u7F3A\u4E4F\u5185\u5728\u9A71\u52A8\u529B")).toBeDefined();
    expect(screen.getByText(/\u5F71\u54CD 8\/10/)).toBeDefined();
  });

  it("renders core issue root cause and improvement", () => {
    render(<LiteraryDiagnosis data={mockData} />);
    expect(screen.getByText(/\u89D2\u8272\u50CF\u63D0\u7EBF\u6728\u5076\u3002/)).toBeDefined();
    expect(screen.getByText(/WANT vs NEED/)).toBeDefined();
  });

  it("renders all five dimensions", () => {
    render(<LiteraryDiagnosis data={mockData} />);
    expect(screen.getByText("\u53D9\u4E8B\u52A8\u529B")).toBeDefined();
    expect(screen.getByText("\u60C5\u611F\u771F\u5B9E\u6027")).toBeDefined();
    expect(screen.getByText("\u8282\u594F\u95EE\u9898\u6EAF\u6E90")).toBeDefined();
    expect(screen.getByText("\u89D2\u8272\u58F0\u97F3")).toBeDefined();
    expect(screen.getByText("\u4E3B\u9898\u4E00\u81F4\u6027")).toBeDefined();
  });

  it("auto-expands most severe dimension", () => {
    render(<LiteraryDiagnosis data={mockData} />);
    // narrative_drive has severity 7 (highest) — its rootCause should be visible
    expect(screen.getByText(/\u89D2\u8272\u7F3A\u4E4F\u5185\u5728\u77DB\u76FE\u9A71\u52A8\u3002/)).toBeDefined();
  });

  it("renders severity badge with label", () => {
    render(<LiteraryDiagnosis data={mockData} />);
    // severity 7 = 严重
    expect(screen.getByText(/\u4E25\u91CD \(7\/10\)/)).toBeDefined();
  });

  it("toggles dimension expansion on click", () => {
    render(<LiteraryDiagnosis data={mockData} />);

    // emotional_authenticity (severity 5) should be collapsed initially
    expect(screen.queryByText(/\u60C5\u611F\u8868\u8FBE\u4F9D\u8D56\u544A\u8BC9\u800C\u975E\u5C55\u793A\u3002/)).toBeNull();

    // Click to expand
    fireEvent.click(screen.getByText("\u60C5\u611F\u771F\u5B9E\u6027"));
    expect(screen.getByText(/\u60C5\u611F\u8868\u8FBE\u4F9D\u8D56\u544A\u8BC9\u800C\u975E\u5C55\u793A\u3002/)).toBeDefined();

    // Click again to collapse
    fireEvent.click(screen.getByText("\u60C5\u611F\u771F\u5B9E\u6027"));
    expect(screen.queryByText(/\u60C5\u611F\u8868\u8FBE\u4F9D\u8D56\u544A\u8BC9\u800C\u975E\u5C55\u793A\u3002/)).toBeNull();
  });

  it("renders evidence when present", () => {
    render(<LiteraryDiagnosis data={mockData} />);
    // narrative_drive is auto-expanded and has evidence
    expect(screen.getByText(/\u4ED6\u8D70\u51FA\u5C71\u95E8/)).toBeDefined();
  });

  it("renders improvement direction", () => {
    render(<LiteraryDiagnosis data={mockData} />);
    // narrative_drive is auto-expanded
    expect(screen.getByText(/\u7ED9\u89D2\u8272\u8BBE\u5B9A\u5185\u5728\u77DB\u76FE\u3002/)).toBeDefined();
  });

  it("handles no core issues", () => {
    const data: LiteraryDiagnosisData = { ...mockData, coreIssues: [] };
    render(<LiteraryDiagnosis data={data} />);
    expect(screen.queryByText(/\u6838\u5FC3\u95EE\u9898/)).toBeNull();
  });

  it("renders dimension labels in core issue badges", () => {
    render(<LiteraryDiagnosis data={mockData} />);
    // Core issue spans narrative_drive and pacing_root_cause
    // Their labels should appear as badges within the core issue section
    const narrativeBadges = screen.getAllByText(/\u53D9\u4E8B\u52A8\u529B/);
    expect(narrativeBadges.length).toBeGreaterThanOrEqual(2); // dimension card + core issue badge
  });
});
