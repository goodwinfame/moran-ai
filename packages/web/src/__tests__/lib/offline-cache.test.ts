/**
 * Tests for Offline Cache (T8)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock idb ───────────────────────────────────────────────────────────────────

const mockPut = vi.fn().mockResolvedValue(undefined);
const mockGet = vi.fn();

vi.mock("idb", () => ({
  openDB: vi.fn().mockImplementation(async () => ({
    put: mockPut,
    get: mockGet,
  })),
}));

import { cacheTabData, getCachedTabData } from "@/lib/offline-cache";

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("cacheTabData()", () => {
  it("calls db.put with the correct key format", async () => {
    await cacheTabData("proj-1", "characters", { items: [] });

    expect(mockPut).toHaveBeenCalledOnce();
    const [storeName, entry] = mockPut.mock.calls[0] as [string, { key: string }];
    expect(storeName).toBe("panel-data");
    expect(entry.key).toBe("proj-1:characters");
  });

  it("stores the provided data in the entry", async () => {
    const payload = { characters: [{ id: "c1", name: "Alice" }] };
    await cacheTabData("proj-2", "outline", payload);

    const [, entry] = mockPut.mock.calls[0] as [string, { data: unknown }];
    expect(entry.data).toEqual(payload);
  });

  it("includes a numeric timestamp in the entry", async () => {
    await cacheTabData("proj-3", "chapters", "some data");

    const [, entry] = mockPut.mock.calls[0] as [string, { timestamp: number }];
    expect(typeof entry.timestamp).toBe("number");
    expect(entry.timestamp).toBeGreaterThan(0);
  });

  it("uses the composite key projectId:tab", async () => {
    await cacheTabData("my-project", "knowledge", null);
    const [, entry] = mockPut.mock.calls[0] as [string, { key: string }];
    expect(entry.key).toBe("my-project:knowledge");
  });
});

describe("getCachedTabData()", () => {
  it("returns the cached data when an entry exists", async () => {
    const storedData = { items: ["a", "b"] };
    mockGet.mockResolvedValueOnce({
      key: "proj-1:brainstorm",
      data: storedData,
      timestamp: 1000,
    });

    const result = await getCachedTabData("proj-1", "brainstorm");
    expect(result).toEqual(storedData);
  });

  it("queries with the correct composite key", async () => {
    mockGet.mockResolvedValueOnce(undefined);
    await getCachedTabData("project-x", "review");

    const [storeName, key] = mockGet.mock.calls[0] as [string, string];
    expect(storeName).toBe("panel-data");
    expect(key).toBe("project-x:review");
  });

  it("returns null when no entry exists", async () => {
    mockGet.mockResolvedValueOnce(undefined);
    const result = await getCachedTabData("missing-project", "analysis");
    expect(result).toBeNull();
  });

  it("returns null when entry is null", async () => {
    mockGet.mockResolvedValueOnce(null);
    const result = await getCachedTabData("p1", "settings");
    expect(result).toBeNull();
  });

  it("returns falsy data values correctly (e.g. empty array)", async () => {
    mockGet.mockResolvedValueOnce({
      key: "p1:chapters",
      data: [],
      timestamp: 123,
    });
    const result = await getCachedTabData("p1", "chapters");
    expect(result).toEqual([]);
  });
});
