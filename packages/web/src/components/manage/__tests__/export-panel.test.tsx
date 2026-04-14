import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExportPanel } from "@/components/manage/export-panel";

// Mock fetch globally
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  // Mock URL.createObjectURL / revokeObjectURL
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:mock-url"),
    revokeObjectURL: vi.fn(),
  });
  mockFetch.mockReset();
});

describe("ExportPanel", () => {
  it("renders format selection buttons", () => {
    render(<ExportPanel projectId="p1" />);

    expect(screen.getByTestId("format-epub")).toBeDefined();
    expect(screen.getByTestId("format-txt")).toBeDefined();
    expect(screen.getByTestId("format-markdown")).toBeDefined();
  });

  it("renders export button", () => {
    render(<ExportPanel projectId="p1" />);
    expect(screen.getByTestId("export-button")).toBeDefined();
  });

  it("renders title", () => {
    render(<ExportPanel projectId="p1" />);
    expect(screen.getByText("\u5BFC\u51FA\u5C0F\u8BF4")).toBeDefined();
  });

  it("shows EPUB description by default", () => {
    render(<ExportPanel projectId="p1" />);
    expect(screen.getByText(/EPUB.*\u7535\u5B50\u4E66\u9605\u8BFB\u5668/)).toBeDefined();
  });

  it("switches format description when clicking TXT", () => {
    render(<ExportPanel projectId="p1" />);
    fireEvent.click(screen.getByTestId("format-txt"));
    expect(screen.getByText(/TXT.*\u517C\u5BB9\u6027\u6700\u5F3A/)).toBeDefined();
  });

  it("switches format description when clicking Markdown", () => {
    render(<ExportPanel projectId="p1" />);
    fireEvent.click(screen.getByTestId("format-markdown"));
    expect(screen.getByText(/Markdown.*\u76EE\u5F55/)).toBeDefined();
  });

  it("shows range inputs when toggle checked", () => {
    render(<ExportPanel projectId="p1" totalChapters={50} />);

    // Initially no range inputs
    expect(screen.queryByTestId("start-chapter")).toBeNull();

    // Toggle range
    fireEvent.click(screen.getByTestId("range-toggle"));

    expect(screen.getByTestId("start-chapter")).toBeDefined();
    expect(screen.getByTestId("end-chapter")).toBeDefined();
  });

  it("hides range inputs when toggle unchecked", () => {
    render(<ExportPanel projectId="p1" />);

    // Toggle on then off
    fireEvent.click(screen.getByTestId("range-toggle"));
    expect(screen.getByTestId("start-chapter")).toBeDefined();

    fireEvent.click(screen.getByTestId("range-toggle"));
    expect(screen.queryByTestId("start-chapter")).toBeNull();
  });

  it("triggers download on export click", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        "content-disposition": "attachment; filename*=UTF-8''%E4%BB%99%E9%80%94.epub",
      }),
      blob: () => Promise.resolve(new Blob(["fake epub"], { type: "application/epub+zip" })),
    });

    render(<ExportPanel projectId="p1" />);
    fireEvent.click(screen.getByTestId("export-button"));

    // fetch should be called
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const callUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain("/export/epub");
    expect(callUrl).toContain("p1");
  });

  it("shows success badge after successful export", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers(),
      blob: () => Promise.resolve(new Blob(["test"])),
    });

    render(<ExportPanel projectId="p1" />);
    fireEvent.click(screen.getByTestId("export-button"));

    await vi.waitFor(() => {
      expect(screen.getByTestId("export-success")).toBeDefined();
    });
  });

  it("shows error badge on failed export", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "\u670D\u52A1\u5668\u9519\u8BEF" }),
    });

    render(<ExportPanel projectId="p1" />);
    fireEvent.click(screen.getByTestId("export-button"));

    await vi.waitFor(() => {
      expect(screen.getByTestId("export-error")).toBeDefined();
    });
  });

  it("sends range params when range enabled", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers(),
      blob: () => Promise.resolve(new Blob(["test"])),
    });

    render(<ExportPanel projectId="p1" totalChapters={50} />);

    // Enable range
    fireEvent.click(screen.getByTestId("range-toggle"));

    // Change start to 5
    const startInput = screen.getByTestId("start-chapter");
    fireEvent.change(startInput, { target: { value: "5" } });

    // Change end to 10
    const endInput = screen.getByTestId("end-chapter");
    fireEvent.change(endInput, { target: { value: "10" } });

    // Export
    fireEvent.click(screen.getByTestId("export-button"));

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const callUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain("start=5");
    expect(callUrl).toContain("end=10");
  });

  it("does not send range params when range disabled", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers(),
      blob: () => Promise.resolve(new Blob(["test"])),
    });

    render(<ExportPanel projectId="p1" />);
    fireEvent.click(screen.getByTestId("export-button"));

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const callUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(callUrl).not.toContain("start=");
    expect(callUrl).not.toContain("end=");
  });

  it("uses correct format in download URL for TXT", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers(),
      blob: () => Promise.resolve(new Blob(["test"])),
    });

    render(<ExportPanel projectId="p1" />);
    fireEvent.click(screen.getByTestId("format-txt"));
    fireEvent.click(screen.getByTestId("export-button"));

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const callUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain("/export/txt");
  });

  it("shows retry button on error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "fail" }),
    });

    render(<ExportPanel projectId="p1" />);
    fireEvent.click(screen.getByTestId("export-button"));

    await vi.waitFor(() => {
      expect(screen.getByText("\u91CD\u8BD5")).toBeDefined();
    });
  });
});
