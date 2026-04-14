import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConnectionIndicator } from "../connection-indicator";

describe("ConnectionIndicator", () => {
  it("renders disconnected state", () => {
    render(<ConnectionIndicator status="disconnected" retryCount={0} />);
    expect(screen.getByText("未连接")).toBeInTheDocument();
  });

  it("renders connecting state", () => {
    render(<ConnectionIndicator status="connecting" retryCount={0} />);
    expect(screen.getByText("连接中…")).toBeInTheDocument();
  });

  it("renders connected state", () => {
    render(<ConnectionIndicator status="connected" retryCount={0} />);
    expect(screen.getByText("已连接")).toBeInTheDocument();
  });

  it("renders reconnecting state with retry count", () => {
    render(<ConnectionIndicator status="reconnecting" retryCount={3} />);
    expect(screen.getByText(/重连中…/)).toBeInTheDocument();
    expect(screen.getByText("(3)")).toBeInTheDocument();
  });

  it("shows retry button when disconnected with retries", () => {
    const onRetry = vi.fn();
    render(
      <ConnectionIndicator
        status="disconnected"
        retryCount={5}
        onRetry={onRetry}
      />,
    );
    const retryButton = screen.getByText("重试");
    expect(retryButton).toBeInTheDocument();
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not show retry button when connected", () => {
    const onRetry = vi.fn();
    render(
      <ConnectionIndicator
        status="connected"
        retryCount={0}
        onRetry={onRetry}
      />,
    );
    expect(screen.queryByText("重试")).not.toBeInTheDocument();
  });

  it("does not show retry button when no retries yet", () => {
    const onRetry = vi.fn();
    render(
      <ConnectionIndicator
        status="disconnected"
        retryCount={0}
        onRetry={onRetry}
      />,
    );
    expect(screen.queryByText("重试")).not.toBeInTheDocument();
  });

  it("has green dot when connected", () => {
    render(<ConnectionIndicator status="connected" retryCount={0} />);
    const dot = screen.getByLabelText("已连接");
    expect(dot.className).toContain("bg-green-500");
  });

  it("has pulsing dot when reconnecting", () => {
    render(<ConnectionIndicator status="reconnecting" retryCount={1} />);
    const dot = screen.getByLabelText("重连中…");
    expect(dot.className).toContain("animate-pulse");
  });
});
