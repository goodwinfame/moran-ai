import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { ChatNavBar } from "@/components/chat/ChatNavBar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/shared/InlineEditor", () => ({
  InlineEditor: ({ value }: { value: string }) => <span>{value}</span>,
}));

vi.mock("@/components/chat/TokenPopover", () => ({
  TokenPopover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { mockApiGet, mockApiPut } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPut: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
  },
}));

const projectData = {
  name: "My Novel",
  status: "writing",
  currentChapter: 3,
  chapterCount: 10,
  wordCount: 5000,
};

const usageData = {
  totalTokens: 1000,
  totalCostUsd: 0.0025,
  byAgent: {},
  byModel: {},
};

describe("ChatNavBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders project name and stats after loading", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes("/usage/summary")) {
        return Promise.resolve({ data: usageData });
      }
      return Promise.resolve({ data: projectData });
    });

    render(<ChatNavBar projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByText("My Novel")).toBeDefined();
    });
    expect(screen.getByText("5,000 字")).toBeDefined();
  });

  it("shows 0 Token when usage fetch fails", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes("/usage/summary")) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve({ data: projectData });
    });

    render(<ChatNavBar projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByText("My Novel")).toBeDefined();
    });
    expect(screen.getByText("0 Token")).toBeDefined();
  });

  it("formats large token counts with K suffix", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes("/usage/summary")) {
        return Promise.resolve({ data: { ...usageData, totalTokens: 12300 } });
      }
      return Promise.resolve({ data: projectData });
    });

    render(<ChatNavBar projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByText("12.3K Token")).toBeDefined();
    });
  });

  it("formats million token counts with M suffix", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes("/usage/summary")) {
        return Promise.resolve({ data: { ...usageData, totalTokens: 1234567 } });
      }
      return Promise.resolve({ data: projectData });
    });

    render(<ChatNavBar projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByText("1.2M Token")).toBeDefined();
    });
  });
});
