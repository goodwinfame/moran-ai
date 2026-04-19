import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LoginPage from "@/app/login/page";
import { api } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
  },
}));

// Next.js Link mock
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { useRouter, useSearchParams } from "next/navigation";

const mockPush = vi.fn();
const mockSearchParamsGet = vi.fn();

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({ push: mockPush });
    (useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue({
      get: mockSearchParamsGet.mockReturnValue(null),
    });
  });

  it("renders email and password inputs and submit button", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText("邮箱")).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "登录" }),
    ).toBeInTheDocument();
  });

  it("has a link to the register page", () => {
    render(<LoginPage />);

    const link = screen.getByRole("link", { name: "注册" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/register");
  });

  it("shows error message on invalid credentials", async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue({
      error: "邮箱或密码错误",
      status: 401,
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "wrong@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "wrongpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("邮箱或密码错误")).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("redirects to '/' on successful login when no redirect param", async () => {
    mockSearchParamsGet.mockReturnValue(null);
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: { userId: "user-1" },
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("redirects to the redirect param on successful login", async () => {
    mockSearchParamsGet.mockReturnValue("/projects/abc");
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: { userId: "user-1" },
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/projects/abc");
    });
  });

  it("shows loading state while submitting", async () => {
    let resolvePost!: (value: unknown) => void;
    const pendingPost = new Promise((resolve) => {
      resolvePost = resolve;
    });
    (api.post as ReturnType<typeof vi.fn>).mockReturnValue(pendingPost);

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "登录中..." })).toBeDisabled();
    });

    resolvePost({ ok: true, data: { userId: "user-1" } });
  });
});
