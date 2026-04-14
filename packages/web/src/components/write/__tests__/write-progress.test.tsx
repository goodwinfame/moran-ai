import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WriteProgress } from "@/components/write/write-progress";

describe("WriteProgress", () => {
  it("shows idle state", () => {
    render(<WriteProgress stage="idle" />);
    expect(screen.getByText("空闲")).toBeDefined();
  });

  it("shows context building state", () => {
    render(<WriteProgress stage="context" />);
    expect(screen.getByText("构建上下文")).toBeDefined();
  });

  it("shows writing state", () => {
    render(<WriteProgress stage="writing" />);
    expect(screen.getByText("执笔写作中")).toBeDefined();
  });

  it("shows reviewing state", () => {
    render(<WriteProgress stage="reviewing" />);
    expect(screen.getByText("明镜审校中")).toBeDefined();
  });

  it("shows archiving state", () => {
    render(<WriteProgress stage="archiving" />);
    expect(screen.getByText("载史归档中")).toBeDefined();
  });

  it("shows done state", () => {
    render(<WriteProgress stage="done" />);
    expect(screen.getByText("完成")).toBeDefined();
  });

  it("shows error state", () => {
    render(<WriteProgress stage="error" />);
    expect(screen.getByText("出错")).toBeDefined();
  });

  it("renders stage indicator dots", () => {
    render(<WriteProgress stage="writing" />);
    expect(screen.getByText("上下文")).toBeDefined();
    expect(screen.getByText("写作")).toBeDefined();
    expect(screen.getByText("审校")).toBeDefined();
    expect(screen.getByText("归档")).toBeDefined();
  });
});
