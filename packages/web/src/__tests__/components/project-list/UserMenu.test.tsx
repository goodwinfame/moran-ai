import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { UserMenu } from "@/components/project-list/UserMenu";

describe("UserMenu", () => {
  it("renders avatar button", () => {
    render(<UserMenu />);
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("opens dropdown menu on click", async () => {
    render(<UserMenu />);
    const button = screen.getByRole("button");
    
    // Radix dropdown trigger responds to pointer down
    fireEvent.pointerDown(button);
    
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
    
    expect(screen.getByText("个人设置")).toBeInTheDocument();
    expect(screen.getByText("使用统计")).toBeInTheDocument();
    expect(screen.getByText("退出登录")).toBeInTheDocument();
  });
});
