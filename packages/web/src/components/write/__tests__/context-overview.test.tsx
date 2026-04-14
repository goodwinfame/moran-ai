import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContextOverview } from "@/components/write/context-overview";

describe("ContextOverview", () => {
  it("shows waiting state when no budget", () => {
    render(
      <ContextOverview
        stage="idle"
        wordCount={0}
        budget={null}
        reviewResult={null}
        error={null}
      />,
    );

    expect(screen.getByText("等待写作开始...")).toBeDefined();
  });

  it("displays word count", () => {
    render(
      <ContextOverview
        stage="writing"
        wordCount={3500}
        budget={null}
        reviewResult={null}
        error={null}
      />,
    );

    expect(screen.getByText("3,500")).toBeDefined();
  });

  it("renders budget bar when budget provided", () => {
    render(
      <ContextOverview
        stage="writing"
        wordCount={1000}
        budget={{ total: 50000, used: 12000, remaining: 38000 }}
        reviewResult={null}
        error={null}
      />,
    );

    expect(screen.getByText(/已用 12,000/)).toBeDefined();
    expect(screen.getByText(/剩余 38,000/)).toBeDefined();
  });

  it("displays review result when passed", () => {
    render(
      <ContextOverview
        stage="done"
        wordCount={4000}
        budget={null}
        reviewResult={{ round: 1, passed: true, score: 85 }}
        error={null}
      />,
    );

    expect(screen.getByText(/第1轮/)).toBeDefined();
    expect(screen.getByText("通过")).toBeDefined();
    expect(screen.getByText("85分")).toBeDefined();
  });

  it("displays review result when failed", () => {
    render(
      <ContextOverview
        stage="reviewing"
        wordCount={3000}
        budget={null}
        reviewResult={{
          round: 2,
          passed: false,
          score: 62,
          issues: [
            { severity: "MAJOR", message: "角色对话不够自然" },
            { severity: "MINOR", message: "个别用词生硬" },
          ],
        }}
        error={null}
      />,
    );

    expect(screen.getByText("需修改")).toBeDefined();
    expect(screen.getByText("角色对话不够自然")).toBeDefined();
  });

  it("shows error when in error state", () => {
    render(
      <ContextOverview
        stage="error"
        wordCount={0}
        budget={null}
        reviewResult={null}
        error="SSE 连接已关闭"
      />,
    );

    expect(screen.getByText("SSE 连接已关闭")).toBeDefined();
  });
});
