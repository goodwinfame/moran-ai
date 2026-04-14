import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChapterContent } from "@/components/read/chapter-content";

describe("ChapterContent", () => {
  it("shows placeholder when no content", () => {
    render(
      <ChapterContent
        content={null}
        title={null}
        chapterNumber={null}
        loading={false}
      />,
    );

    expect(screen.getByText("选择左侧章节开始阅读")).toBeDefined();
  });

  it("renders chapter heading", () => {
    render(
      <ChapterContent
        content="第一段正文内容。"
        title="初入江湖"
        chapterNumber={1}
        loading={false}
      />,
    );

    expect(screen.getByText("第1章")).toBeDefined();
    expect(screen.getByText("初入江湖")).toBeDefined();
  });

  it("splits content into paragraphs", () => {
    const content = "第一段。\n\n第二段。\n\n第三段。";
    render(
      <ChapterContent
        content={content}
        title={null}
        chapterNumber={1}
        loading={false}
      />,
    );

    expect(screen.getByText("第一段。")).toBeDefined();
    expect(screen.getByText("第二段。")).toBeDefined();
    expect(screen.getByText("第三段。")).toBeDefined();
  });

  it("shows loading state", () => {
    const { container } = render(
      <ChapterContent
        content={null}
        title={null}
        chapterNumber={null}
        loading={true}
      />,
    );

    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeDefined();
  });
});
