import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WriteControls } from "@/components/write/write-controls";

describe("WriteControls", () => {
  const noop = () => {};

  it("shows write and continuous buttons when idle", () => {
    render(
      <WriteControls
        stage="idle"
        onWriteNext={noop}
        onContinuous={noop}
        onStop={noop}
        onReset={noop}
      />,
    );

    expect(screen.getByText("写下一章")).toBeDefined();
    expect(screen.getByText("连续写作")).toBeDefined();
  });

  it("shows stop button when writing", () => {
    render(
      <WriteControls
        stage="writing"
        onWriteNext={noop}
        onContinuous={noop}
        onStop={noop}
        onReset={noop}
      />,
    );

    expect(screen.getByText("中止")).toBeDefined();
  });

  it("shows stop button when reviewing", () => {
    render(
      <WriteControls
        stage="reviewing"
        onWriteNext={noop}
        onContinuous={noop}
        onStop={noop}
        onReset={noop}
      />,
    );

    expect(screen.getByText("中止")).toBeDefined();
  });

  it("shows write+continuous+reset when done", () => {
    render(
      <WriteControls
        stage="done"
        onWriteNext={noop}
        onContinuous={noop}
        onStop={noop}
        onReset={noop}
      />,
    );

    expect(screen.getByText("写下一章")).toBeDefined();
    expect(screen.getByText("连续写作")).toBeDefined();
    expect(screen.getByText("重置")).toBeDefined();
  });

  it("shows reset button on error", () => {
    render(
      <WriteControls
        stage="error"
        onWriteNext={noop}
        onContinuous={noop}
        onStop={noop}
        onReset={noop}
      />,
    );

    expect(screen.getByText("重置")).toBeDefined();
  });

  it("calls onWriteNext when clicked", () => {
    let called = false;
    render(
      <WriteControls
        stage="idle"
        onWriteNext={() => { called = true; }}
        onContinuous={noop}
        onStop={noop}
        onReset={noop}
      />,
    );

    fireEvent.click(screen.getByText("写下一章"));
    expect(called).toBe(true);
  });

  it("calls onStop when clicked during writing", () => {
    let called = false;
    render(
      <WriteControls
        stage="writing"
        onWriteNext={noop}
        onContinuous={noop}
        onStop={() => { called = true; }}
        onReset={noop}
      />,
    );

    fireEvent.click(screen.getByText("中止"));
    expect(called).toBe(true);
  });
});
