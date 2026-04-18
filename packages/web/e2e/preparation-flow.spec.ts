import { test, expect } from "@playwright/test";

test.describe("Preparation Flow", () => {
  const projectId = "test-project-1";
  const baseUrl = `/projects/${projectId}/prep`;

  test("prep sidebar shows all 6 steps", async ({ page }) => {
    await page.goto(`${baseUrl}/intent`);
    const steps = ["创作意图", "世界观", "角色", "文风", "大纲", "准备就绪"];
    for (const step of steps) {
      await expect(page.locator("aside").getByText(step, { exact: true })).toBeVisible();
    }
  });

  test("intent step is active when visiting prep/intent", async ({ page }) => {
    await page.goto(`${baseUrl}/intent`);
    // Active step has white bg with navy text and font-bold
    const firstNavLink = page.locator("aside nav a").first();
    await expect(firstNavLink).toHaveClass(/bg-white/);
    await expect(firstNavLink).toHaveClass(/font-bold/);
  });

  test("can navigate between prep steps via sidebar", async ({ page }) => {
    await page.goto(`${baseUrl}/intent`);

    // Click on "世界观" step
    await page.locator("aside").getByText("世界观", { exact: true }).click();
    await expect(page).toHaveURL(/\/prep\/world/);

    // Click on "角色" step
    await page.locator("aside").getByText("角色", { exact: true }).click();
    await expect(page).toHaveURL(/\/prep\/characters/);

    // Click on "大纲" step
    await page.locator("aside").getByText("大纲", { exact: true }).click();
    await expect(page).toHaveURL(/\/prep\/outline/);
  });

  test("prep pages render content area", async ({ page }) => {
    await page.goto(`${baseUrl}/intent`);
    // Should see the alignment layout sections
    await expect(page.locator("section").first()).toBeVisible();
  });

  test("sidebar has dark navy background", async ({ page }) => {
    await page.goto(`${baseUrl}/intent`);
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveClass(/bg-\[#1A202C\]/);
  });
});
