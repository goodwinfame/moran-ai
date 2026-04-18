import { test, expect } from "@playwright/test";

test.describe("Create Project Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/projects/new");
  });

  test("shows page header with logo linking back to home", async ({ page }) => {
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByText("墨染")).toBeVisible();
    const logoLink = page.locator("header a").first();
    await expect(logoLink).toHaveAttribute("href", "/");
  });

  test("shows page title", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "创建新项目" })).toBeVisible();
  });

  test("shows project name input with placeholder", async ({ page }) => {
    await expect(page.getByLabel(/项目名称/)).toBeVisible();
    await expect(page.getByPlaceholder("给你的故事起个名字")).toBeVisible();
  });

  test("shows 8 genre cards", async ({ page }) => {
    const genres = ["玄幻", "都市", "言情", "科幻", "悬疑", "历史", "同人", "自定义"];
    for (const genre of genres) {
      await expect(page.getByText(genre, { exact: true })).toBeVisible();
    }
  });

  test("shows inspiration textarea", async ({ page }) => {
    await expect(page.getByLabel(/一句话灵感/)).toBeVisible();
  });

  test("shows target length select", async ({ page }) => {
    const select = page.getByLabel(/目标篇幅/);
    await expect(select).toBeVisible();
  });

  test("submit button is disabled when name is empty", async ({ page }) => {
    await expect(page.getByRole("button", { name: "开始创作" })).toBeDisabled();
  });

  test("submit button becomes enabled after typing project name", async ({ page }) => {
    await page.getByPlaceholder("给你的故事起个名字").fill("我的第一部小说");
    await expect(page.getByRole("button", { name: "开始创作" })).toBeEnabled();
  });

  test("submit button goes disabled again when name is cleared", async ({ page }) => {
    const input = page.getByPlaceholder("给你的故事起个名字");
    await input.fill("临时名称");
    await input.fill("");
    await expect(page.getByRole("button", { name: "开始创作" })).toBeDisabled();
  });

  test("clicking genre card selects it", async ({ page }) => {
    const fantasyBtn = page.getByText("玄幻", { exact: true }).locator("..");
    await fantasyBtn.click();
    await expect(fantasyBtn).toHaveClass(/ring-2/);
  });

  test("clicking selected genre card deselects it", async ({ page }) => {
    const fantasyBtn = page.getByText("玄幻", { exact: true }).locator("..");
    await fantasyBtn.click();
    await expect(fantasyBtn).toHaveClass(/ring-2/);
    await fantasyBtn.click();
    await expect(fantasyBtn).not.toHaveClass(/ring-2/);
  });

  test("only one genre can be selected at a time", async ({ page }) => {
    const fantasyBtn = page.getByText("玄幻", { exact: true }).locator("..");
    const urbanBtn = page.getByText("都市", { exact: true }).locator("..");
    await fantasyBtn.click();
    await urbanBtn.click();
    await expect(fantasyBtn).not.toHaveClass(/ring-2/);
    await expect(urbanBtn).toHaveClass(/ring-2/);
  });

  test("submitting form with name navigates to prep/intent", async ({ page }) => {
    await page.getByPlaceholder("给你的故事起个名字").fill("星辰大海");
    await Promise.all([
      page.waitForURL(/\/prep\/intent/),
      page.getByRole("button", { name: "开始创作" }).click(),
    ]);
    await expect(page).toHaveURL(/\/prep\/intent/);
  });

  test("cannot submit without project name - stays on page", async ({ page }) => {
    await expect(page.getByRole("button", { name: "开始创作" })).toBeDisabled();
    await expect(page).toHaveURL(/\/projects\/new/);
  });
});
