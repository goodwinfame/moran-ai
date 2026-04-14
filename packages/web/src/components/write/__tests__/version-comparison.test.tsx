import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VersionComparison } from "@/components/write/version-comparison";

const mockData = {
  chapterNumber: 1,
  hasPassingVersion: true,
  totalVersions: 3,
  passingVersions: 2,
  selectedVersion: 2,
  versions: [
    {
      versionIndex: 1,
      wordCount: 2800,
      temperature: 0.72,
      score: 68,
      passed: false,
      isSelected: false,
    },
    {
      versionIndex: 2,
      wordCount: 3200,
      temperature: 0.8,
      score: 85,
      passed: true,
      isSelected: true,
    },
    {
      versionIndex: 3,
      wordCount: 3000,
      temperature: 0.88,
      score: 76,
      passed: true,
      isSelected: false,
    },
  ],
};

describe("VersionComparison", () => {
  it("renders empty state when data is null", () => {
    render(<VersionComparison data={null} />);
    expect(screen.getByText("\u672A\u542F\u7528\u591A\u7248\u672C\u62E9\u4F18")).toBeDefined();
  });

  it("renders version list with correct count", () => {
    render(<VersionComparison data={mockData} />);
    expect(screen.getByText("\u7248\u672C\u5BF9\u6BD4")).toBeDefined();
    expect(screen.getByText("3 \u4E2A\u7248\u672C")).toBeDefined();
    expect(screen.getByText("2 \u4E2A\u901A\u8FC7")).toBeDefined();
  });

  it("renders chapter number badge", () => {
    render(<VersionComparison data={mockData} />);
    // The badge renders "第1章" as a single badge element
    const badge = screen.getByText((_content, element) => {
      return element?.textContent === "\u7B2C1\u7AE0" && element?.tagName !== "BODY";
    });
    expect(badge).toBeDefined();
  });

  it("renders all version cards", () => {
    render(<VersionComparison data={mockData} />);
    expect(screen.getByText("V1")).toBeDefined();
    expect(screen.getByText("V2")).toBeDefined();
    expect(screen.getByText("V3")).toBeDefined();
  });

  it("shows scores for each version", () => {
    render(<VersionComparison data={mockData} />);
    expect(screen.getByText("68")).toBeDefined();
    expect(screen.getByText("85")).toBeDefined();
    expect(screen.getByText("76")).toBeDefined();
  });

  it("shows passed/failed badges", () => {
    render(<VersionComparison data={mockData} />);
    const passedBadges = screen.getAllByText("\u901A\u8FC7");
    const failedBadges = screen.getAllByText("\u672A\u901A\u8FC7");
    expect(passedBadges).toHaveLength(2);
    expect(failedBadges).toHaveLength(1);
  });

  it("shows selected badge on selected version", () => {
    render(<VersionComparison data={mockData} />);
    expect(screen.getByText("\u5DF2\u9009\u4E2D")).toBeDefined();
  });

  it("shows word counts", () => {
    render(<VersionComparison data={mockData} />);
    expect(screen.getByText("2800")).toBeDefined();
    expect(screen.getByText("3200")).toBeDefined();
    expect(screen.getByText("3000")).toBeDefined();
  });

  it("shows temperatures", () => {
    render(<VersionComparison data={mockData} />);
    expect(screen.getByText("0.720")).toBeDefined();
    expect(screen.getByText("0.800")).toBeDefined();
    expect(screen.getByText("0.880")).toBeDefined();
  });

  it("shows warning when no versions pass", () => {
    const noPassData = {
      ...mockData,
      hasPassingVersion: false,
      passingVersions: 0,
      versions: mockData.versions.map((v) => ({ ...v, passed: false })),
    };
    render(<VersionComparison data={noPassData} />);
    expect(screen.getByText(/\u6240\u6709\u7248\u672C\u5747\u672A\u901A\u8FC7\u5BA1\u6821/)).toBeDefined();
  });

  it("expands version detail on click", async () => {
    const mockLoadDetail = vi.fn().mockResolvedValue({
      ...mockData.versions[0],
      content: "\u6D4B\u8BD5\u5185\u5BB9\u6587\u672C",
    });

    render(<VersionComparison data={mockData} onLoadDetail={mockLoadDetail} />);

    const v1Button = screen.getByText("V1").closest("button");
    expect(v1Button).toBeDefined();
    if (v1Button) {
      fireEvent.click(v1Button);
    }

    await waitFor(() => {
      expect(mockLoadDetail).toHaveBeenCalledWith(1);
    });
  });

  it("calls onSelect when select button is clicked", async () => {
    const mockSelect = vi.fn().mockResolvedValue(undefined);
    const mockLoadDetail = vi.fn().mockResolvedValue({
      ...mockData.versions[2],
      content: "\u7248\u672C3\u5185\u5BB9",
    });

    render(
      <VersionComparison
        data={mockData}
        onLoadDetail={mockLoadDetail}
        onSelect={mockSelect}
      />,
    );

    // Click V3 (not selected) to expand
    const v3Button = screen.getByText("V3").closest("button");
    if (v3Button) {
      fireEvent.click(v3Button);
    }

    // Wait for detail to load, then click select
    await waitFor(() => {
      expect(screen.getByText("\u9009\u62E9\u6B64\u7248\u672C")).toBeDefined();
    });

    fireEvent.click(screen.getByText("\u9009\u62E9\u6B64\u7248\u672C"));

    await waitFor(() => {
      expect(mockSelect).toHaveBeenCalledWith(3);
    });
  });

  it("does not show select button for already selected version", async () => {
    const mockLoadDetail = vi.fn().mockResolvedValue({
      ...mockData.versions[1],
      content: "\u7248\u672C2\u5185\u5BB9\uFF08\u5DF2\u9009\u4E2D\uFF09",
    });

    render(
      <VersionComparison
        data={mockData}
        onLoadDetail={mockLoadDetail}
        onSelect={vi.fn()}
      />,
    );

    // Click V2 (selected) to expand
    const v2Button = screen.getByText("V2").closest("button");
    if (v2Button) {
      fireEvent.click(v2Button);
    }

    await waitFor(() => {
      expect(mockLoadDetail).toHaveBeenCalledWith(2);
    });

    // Should NOT show select button for already-selected version
    expect(screen.queryByText("\u9009\u62E9\u6B64\u7248\u672C")).toBeNull();
  });
});
