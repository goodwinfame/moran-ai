import { test, expect } from "@playwright/test";
import {
  mockLoginSuccess,
  mockLoginFail,
  mockRegisterFail,
  mockProjectListEmpty,
} from "./helpers/mock-api";

/**
 * Authentication E2E Tests (V2)
 *
 * Covers /login and /register pages plus auth middleware behaviour.
 *
 * Key V2 UI facts:
 * - Login heading: "登录墨染"
 * - Register heading: "注册墨染"
 * - Client-side password mismatch message: "密码不一致"
 * - Middleware matcher: ["/projects/:path*"] — only /projects/* is protected
 * - "/" and "/login" and "/register" are public routes
 */
test.describe("Authentication", () => {
  // ── Login page ──────────────────────────────────────────────────────────────

  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "登录墨染" }),
    ).toBeVisible();

    // Email and password inputs
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();

    // Submit button
    await expect(
      page.getByRole("button", { name: "登录" }),
    ).toBeVisible();
  });

  test("login shows error on invalid credentials", async ({ page }) => {
    await mockLoginFail(page);
    await page.goto("/login");

    await page.locator("#email").fill("user@example.com");
    await page.locator("#password").fill("wrongpassword");
    await page.getByRole("button", { name: "登录" }).click();

    // The error paragraph has role="alert"
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("邮箱或密码错误");
  });

  test("login navigates to home on success", async ({ page }) => {
    await mockLoginSuccess(page);
    // Also mock the projects API so the home page renders cleanly after redirect
    await mockProjectListEmpty(page);

    await page.goto("/login");
    await page.locator("#email").fill("user@example.com");
    await page.locator("#password").fill("correct-password");
    await page.getByRole("button", { name: "登录" }).click();

    // The login page calls router.push(redirect ?? "/") on success.
    // Default redirect is "/" so we should land on the home page.
    await expect(page).toHaveURL("/", { timeout: 10_000 });
  });

  test("login page has register link", async ({ page }) => {
    await page.goto("/login");

    const registerLink = page.getByRole("link", { name: "注册" });
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toHaveAttribute("href", "/register");
  });

  // ── Register page ───────────────────────────────────────────────────────────

  test("register page renders correctly", async ({ page }) => {
    await page.goto("/register");

    await expect(
      page.getByRole("heading", { name: "注册墨染" }),
    ).toBeVisible();

    // Three inputs: email, password, confirm-password
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#confirmPassword")).toBeVisible();

    // Submit button
    await expect(
      page.getByRole("button", { name: "注册" }),
    ).toBeVisible();
  });

  test("register shows password mismatch error", async ({ page }) => {
    await page.goto("/register");

    await page.locator("#email").fill("newuser@example.com");
    await page.locator("#password").fill("password123");
    await page.locator("#confirmPassword").fill("different456");
    await page.getByRole("button", { name: "注册" }).click();

    // Client-side validation fires before any API call
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("密码不一致");
  });

  test("register shows API error", async ({ page }) => {
    await mockRegisterFail(page, "邮箱已注册");
    await page.goto("/register");

    await page.locator("#email").fill("existing@example.com");
    await page.locator("#password").fill("password123");
    await page.locator("#confirmPassword").fill("password123");
    await page.getByRole("button", { name: "注册" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("邮箱已注册");
  });

  test("register page has login link", async ({ page }) => {
    await page.goto("/register");

    const loginLink = page.getByRole("link", { name: "登录" });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute("href", "/login");
  });

  // ── Auth middleware ─────────────────────────────────────────────────────────

  test("redirects to login when accessing projects without auth", async ({
    page,
  }) => {
    // Visit a project page without setting the session_id cookie.
    // Next.js middleware (matcher: ["/projects/:path*"]) should redirect to /login.
    await page.goto("/projects/test-id");

    // After the server-side redirect we should land on /login (possibly with ?redirect=...)
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
