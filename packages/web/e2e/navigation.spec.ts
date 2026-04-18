import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  const projectId = "test-project-1";

  test("project layout shows top navigation bar with logo", async ({ page }) => {
    await page.goto(`/projects/${projectId}/write`);
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByText("墨染")).toBeVisible();
  });

  test("writing routes show 7 panel tabs in header", async ({ page }) => {
    await page.goto(`/projects/${projectId}/write`);
    const tabs = ["阅读", "写作", "审校", "管理", "分析", "设定", "可视化"];
    for (const tab of tabs) {
      await expect(
        page.locator("header nav").getByText(tab, { exact: true }),
      ).toBeVisible();
    }
  });

  test("active panel tab is highlighted", async ({ page }) => {
    await page.goto(`/projects/${projectId}/write`);
    // "写作" tab should be active (navy bg + white text)
    const writeTab = page.locator("header nav").getByText("写作", { exact: true });
    await expect(writeTab).toHaveClass(/bg-\[#1A202C\]/);
    await expect(writeTab).toHaveClass(/text-white/);
  });

  test("clicking panel tab navigates to correct route", async ({ page }) => {
    await page.goto(`/projects/${projectId}/write`);

    // Click "阅读" tab
    await Promise.all([
      page.waitForURL(new RegExp(`/projects/${projectId}/read`)),
      page.locator("header nav").getByText("阅读", { exact: true }).click(),
    ]);

    // Click "分析" tab
    await Promise.all([
      page.waitForURL(new RegExp(`/projects/${projectId}/analysis`)),
      page.locator("header nav").getByText("分析", { exact: true }).click(),
    ]);

    // Click "设定" tab
    await Promise.all([
      page.waitForURL(new RegExp(`/projects/${projectId}/settings`)),
      page.locator("header nav").getByText("设定", { exact: true }).click(),
    ]);
  });

  test("prep routes show breadcrumb instead of panel tabs", async ({ page }) => {
    await page.goto(`/projects/${projectId}/prep/intent`);
    await expect(page.locator("header nav").getByText("筹备阶段")).toBeVisible();
    // Panel tabs should NOT be visible on prep routes
    await expect(
      page.locator("header nav").getByText("写作", { exact: true }),
    ).not.toBeVisible();
  });

  test("logo in project page links to homepage", async ({ page }) => {
    await page.goto(`/projects/${projectId}/write`);
    const logoLink = page.locator("header a").first();
    await expect(logoLink).toHaveAttribute("href", "/");
    await Promise.all([
      page.waitForURL("/"),
      logoLink.click(),
    ]);
  });

  test("header shows help button and user avatar", async ({ page }) => {
    await page.goto(`/projects/${projectId}/write`);
    // Help button exists
    await expect(page.locator("header button")).toBeVisible();
    // User avatar "U" — target the avatar div specifically
    await expect(
      page.locator("header").locator(".rounded-full").getByText("U", { exact: true }),
    ).toBeVisible();
  });
});
