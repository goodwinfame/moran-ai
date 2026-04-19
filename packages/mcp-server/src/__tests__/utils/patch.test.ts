import { describe, expect, it, vi, beforeEach } from "vitest";
import { applyPatches } from "../../utils/patch.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("applyPatches()", () => {
  it("returns original content when patches array is empty", () => {
    const result = applyPatches("hello world", []);
    expect(result.content).toBe("hello world");
    expect(result.applied).toBe(0);
    expect(result.failed).toEqual([]);
  });

  it("applies a single matching patch", () => {
    const result = applyPatches("hello world", [{ find: "world", replace: "earth" }]);
    expect(result.content).toBe("hello earth");
    expect(result.applied).toBe(1);
    expect(result.failed).toEqual([]);
  });

  it("records failed find string when patch does not match", () => {
    const result = applyPatches("hello world", [{ find: "mars", replace: "earth" }]);
    expect(result.content).toBe("hello world");
    expect(result.applied).toBe(0);
    expect(result.failed).toEqual(["mars"]);
  });

  it("applies all patches when all match", () => {
    const content = "foo bar baz";
    const result = applyPatches(content, [
      { find: "foo", replace: "FOO" },
      { find: "bar", replace: "BAR" },
      { find: "baz", replace: "BAZ" },
    ]);
    expect(result.content).toBe("FOO BAR BAZ");
    expect(result.applied).toBe(3);
    expect(result.failed).toEqual([]);
  });

  it("records all failed patches when none match", () => {
    const result = applyPatches("hello world", [
      { find: "abc", replace: "x" },
      { find: "def", replace: "y" },
    ]);
    expect(result.content).toBe("hello world");
    expect(result.applied).toBe(0);
    expect(result.failed).toEqual(["abc", "def"]);
  });

  it("handles mixed matching and non-matching patches", () => {
    const result = applyPatches("hello world", [
      { find: "hello", replace: "hi" },
      { find: "mars", replace: "earth" },
      { find: "world", replace: "planet" },
    ]);
    expect(result.content).toBe("hi planet");
    expect(result.applied).toBe(2);
    expect(result.failed).toEqual(["mars"]);
  });

  it("applies patches sequentially — later patches see earlier results", () => {
    // After first patch, "foo" becomes "bar"; second patch finds "bar"
    const result = applyPatches("foo", [
      { find: "foo", replace: "bar" },
      { find: "bar", replace: "baz" },
    ]);
    expect(result.content).toBe("baz");
    expect(result.applied).toBe(2);
    expect(result.failed).toEqual([]);
  });

  it("only replaces first occurrence (String.replace behavior)", () => {
    const result = applyPatches("aaa", [{ find: "a", replace: "b" }]);
    // String.replace replaces only the first match
    expect(result.content).toBe("baa");
    expect(result.applied).toBe(1);
    expect(result.failed).toEqual([]);
  });

  it("handles empty find string — always matches (String.includes behavior)", () => {
    // "".includes("") is true, so empty find always matches
    const result = applyPatches("hello", [{ find: "", replace: "X" }]);
    expect(result.applied).toBe(1);
    expect(result.failed).toEqual([]);
  });

  it("handles empty content string with non-matching patch", () => {
    const result = applyPatches("", [{ find: "foo", replace: "bar" }]);
    expect(result.content).toBe("");
    expect(result.applied).toBe(0);
    expect(result.failed).toEqual(["foo"]);
  });

  it("handles patch that replaces with empty string", () => {
    const result = applyPatches("hello world", [{ find: " world", replace: "" }]);
    expect(result.content).toBe("hello");
    expect(result.applied).toBe(1);
    expect(result.failed).toEqual([]);
  });

  it("order of failed array matches order of patches", () => {
    const result = applyPatches("abc", [
      { find: "z", replace: "1" },
      { find: "y", replace: "2" },
      { find: "x", replace: "3" },
    ]);
    expect(result.failed).toEqual(["z", "y", "x"]);
  });

  it("second patch fails if first patch removed the text it needed", () => {
    // First patch removes "world", second patch can no longer find "world"
    const result = applyPatches("hello world", [
      { find: "hello world", replace: "hi" },
      { find: "world", replace: "earth" },
    ]);
    expect(result.content).toBe("hi");
    expect(result.applied).toBe(1);
    expect(result.failed).toEqual(["world"]);
  });

  it("returns PatchResult with all three fields", () => {
    const result = applyPatches("test", []);
    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("applied");
    expect(result).toHaveProperty("failed");
  });

  it("handles multiline content", () => {
    const content = "line1\nline2\nline3";
    const result = applyPatches(content, [{ find: "line2", replace: "LINE2" }]);
    expect(result.content).toBe("line1\nLINE2\nline3");
    expect(result.applied).toBe(1);
  });
});
