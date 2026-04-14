import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useExport } from "@/hooks/use-export";

describe("useExport", () => {
  it("provides format list with 3 formats", () => {
    const { result } = renderHook(() => useExport("proj-1"));
    expect(result.current.formats).toHaveLength(3);

    const ids = result.current.formats.map((f) => f.id);
    expect(ids).toContain("epub");
    expect(ids).toContain("txt");
    expect(ids).toContain("markdown");
  });

  it("starts in idle status", () => {
    const { result } = renderHook(() => useExport("proj-1"));
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("each format has label, mimeType, extension", () => {
    const { result } = renderHook(() => useExport("proj-1"));

    for (const fmt of result.current.formats) {
      expect(fmt.label).toBeTruthy();
      expect(fmt.mimeType).toBeTruthy();
      expect(fmt.extension).toMatch(/^\./);
    }
  });

  it("reset clears error and status", () => {
    const { result } = renderHook(() => useExport("proj-1"));

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("returns undefined projectId as error on download", async () => {
    const { result } = renderHook(() => useExport(undefined));

    await act(async () => {
      await result.current.download("epub");
    });

    expect(result.current.error).toBeTruthy();
  });
});
