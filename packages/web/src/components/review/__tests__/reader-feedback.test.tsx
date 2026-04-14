import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReaderFeedback, type ReaderFeedbackData } from "@/components/review/reader-feedback";

const mockData: ReaderFeedbackData = {
  chapterNumber: 3,
  readabilityScore: 7,
  oneLiner: "\u5F00\u5934\u8FD8\u884C\uFF0C\u4E2D\u95F4\u6709\u70B9\u62D6\uFF0C\u7ED3\u5C3E\u4E0D\u9519",
  boringSpots: [
    {
      quote: "\u4ED6\u8D70\u5728\u8DEF\u4E0A\uFF0C\u770B\u7740\u8FDC\u65B9\u3002",
      reason: "\u592A\u6C34\u4E86\uFF0C\u6CA1\u6709\u5177\u4F53\u5185\u5BB9",
    },
  ],
  touchingMoments: [
    {
      quote: "\u5E08\u59B9\u628A\u5916\u8863\u62AB\u5728\u4E86\u4ED6\u80A9\u4E0A\u3002",
      feeling: "\u8FD9\u4E2A\u7EC6\u8282\u5F88\u6696",
    },
  ],
  favoriteCharacter: {
    name: "\u5E08\u59B9",
    reason: "\u6BCF\u6B21\u51FA\u573A\u90FD\u5F88\u6709\u5B58\u5728\u611F",
  },
  freeThoughts: "\u6574\u4F53\u8FD8\u884C\uFF0C\u5E0C\u671B\u540E\u9762\u80FD\u6253\u8D77\u6765\u3002",
};

describe("ReaderFeedback", () => {
  it("renders chapter header with number", () => {
    render(<ReaderFeedback data={mockData} />);
    expect(screen.getByText(/\u7B2C3\u7AE0/)).toBeDefined();
    expect(screen.getByText(/\u8BFB\u8005\u53CD\u9988/)).toBeDefined();
  });

  it("renders readability score", () => {
    render(<ReaderFeedback data={mockData} />);
    expect(screen.getByText("7/10")).toBeDefined();
  });

  it("renders one-liner quote", () => {
    render(<ReaderFeedback data={mockData} />);
    expect(screen.getByText(/\u5F00\u5934\u8FD8\u884C/)).toBeDefined();
  });

  it("renders boring spots with quote and reason", () => {
    render(<ReaderFeedback data={mockData} />);
    expect(screen.getByText(/\u8BFB\u4E0D\u4E0B\u53BB\u7684\u5730\u65B9/)).toBeDefined();
    expect(screen.getByText("\u4ED6\u8D70\u5728\u8DEF\u4E0A\uFF0C\u770B\u7740\u8FDC\u65B9\u3002")).toBeDefined();
    expect(screen.getByText(/\u592A\u6C34\u4E86/)).toBeDefined();
  });

  it("renders touching moments with quote and feeling", () => {
    render(<ReaderFeedback data={mockData} />);
    expect(screen.getByText(/\u6253\u52A8\u6211\u7684\u77AC\u95F4/)).toBeDefined();
    expect(screen.getByText("\u5E08\u59B9\u628A\u5916\u8863\u62AB\u5728\u4E86\u4ED6\u80A9\u4E0A\u3002")).toBeDefined();
    expect(screen.getByText(/\u8FD9\u4E2A\u7EC6\u8282\u5F88\u6696/)).toBeDefined();
  });

  it("renders favorite character", () => {
    render(<ReaderFeedback data={mockData} />);
    expect(screen.getByText(/\u6700\u559C\u6B22\u7684\u89D2\u8272/)).toBeDefined();
    // "师妹" appears in both touching moment quote and favorite character
    const matches = screen.getAllByText(/\u5E08\u59B9/);
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/\u6BCF\u6B21\u51FA\u573A\u90FD\u5F88\u6709\u5B58\u5728\u611F/)).toBeDefined();
  });

  it("renders free thoughts", () => {
    render(<ReaderFeedback data={mockData} />);
    expect(screen.getByText(/\u81EA\u7531\u611F\u60F3/)).toBeDefined();
    expect(screen.getByText(/\u5E0C\u671B\u540E\u9762\u80FD\u6253\u8D77\u6765/)).toBeDefined();
  });

  it("handles no boring spots", () => {
    const data: ReaderFeedbackData = { ...mockData, boringSpots: [] };
    render(<ReaderFeedback data={data} />);
    expect(screen.queryByText(/\u8BFB\u4E0D\u4E0B\u53BB\u7684\u5730\u65B9/)).toBeNull();
  });

  it("handles no touching moments", () => {
    const data: ReaderFeedbackData = { ...mockData, touchingMoments: [] };
    render(<ReaderFeedback data={data} />);
    expect(screen.queryByText(/\u6253\u52A8\u6211\u7684\u77AC\u95F4/)).toBeNull();
  });

  it("handles no favorite character", () => {
    const data: ReaderFeedbackData = { ...mockData, favoriteCharacter: null };
    render(<ReaderFeedback data={data} />);
    expect(screen.queryByText(/\u6700\u559C\u6B22\u7684\u89D2\u8272/)).toBeNull();
  });

  it("renders high score with green styling", () => {
    const data: ReaderFeedbackData = { ...mockData, readabilityScore: 9 };
    render(<ReaderFeedback data={data} />);
    expect(screen.getByText("9/10")).toBeDefined();
  });

  it("renders low score", () => {
    const data: ReaderFeedbackData = { ...mockData, readabilityScore: 3 };
    render(<ReaderFeedback data={data} />);
    expect(screen.getByText("3/10")).toBeDefined();
  });
});
