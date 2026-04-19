import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import RegisterPage from "@/app/register/page";
import { api } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
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

import { useRouter } from "next/navigation";

const mockPush = vi.fn();

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({ push: mockPush });
  });

  it("renders email, password, and confirm password inputs with submit button", () => {
    render(<RegisterPage />);

    expect(screen.getByLabelText("邮箱")).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toBeInTheDocument();
    expect(screen.getByLabelText("确认密码")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "注册" }),
    ).toBeInTheDocument();
  });

  it("has a link to the login page", () => {
    render(<RegisterPage />);

    const link = screen.getByRole("link", { name: "登录" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/login");
  });

  it("shows error when passwords do not match (client-side validation)", async () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("确认密码"), {
      target: { value: "different456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "注册" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("密码不一致")).toBeInTheDocument();
    });

    // Should not call the API
    expect(api.post).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows error message on API failure", async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue({
      error: "该邮箱已被注册",
      status: 400,
    });

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "existing@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("确认密码"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "注册" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("该邮箱已被注册")).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("redirects to '/' on successful registration after auto-login", async () => {
    (api.post as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, data: { userId: "user-1" } }) // register
      .mockResolvedValueOnce({ ok: true, data: { userId: "user-1" } }); // login

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("确认密码"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "注册" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });

    // Should have called both register and login
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(api.post).toHaveBeenNthCalledWith(1, "/api/auth/register", {
      email: "new@example.com",
      password: "password123",
    });
    expect(api.post).toHaveBeenNthCalledWith(2, "/api/auth/login", {
      email: "new@example.com",
      password: "password123",
    });
  });

  it("shows loading state while submitting", async () => {
    let resolvePost!: (value: unknown) => void;
    const pendingPost = new Promise((resolve) => {
      resolvePost = resolve;
    });
    (api.post as ReturnType<typeof vi.fn>).mockReturnValue(pendingPost);

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("确认密码"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "注册" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "注册中..." })).toBeDisabled();
    });

    resolvePost({ ok: true, data: { userId: "user-1" } });
  });
});
