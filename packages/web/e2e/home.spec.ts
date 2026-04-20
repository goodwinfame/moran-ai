import { test, expect } from "@playwright/test";
import {
  mockProjectListEmpty,
  mockProjectList,
  SAMPLE_PROJECT,
} from "./helpers/mock-api";

/**
 * Home Page E2E Tests (V2)
 *
 * Tests cover the project-list page at `/`.
 * Route is public (middleware does not protect `/`).
 *
 * Key V2 UI facts:
 * - Header brand: "M" icon div + "墨染 MoRan" span
 * - UserMenu: Avatar with fallback "U"
 * - Empty state heading: "还没有项目"
 * - Empty state subtitle: "告诉墨衡你想写什么故事吧"
 * - Three example prompt buttons
 * - With projects: "我的项目" heading + card grid
 * - Inline chat input placeholder: "告诉墨衡你想写什么故事..."
 */
test.describe("Home Page", () => {
  // ── Brand identity ──────────────────────────────────────────────────────────

  test("displays brand logo and text", async ({ page }) => {
    // Mock projects so the page settles quickly to a known state
    await mockProjectListEmpty(page);
    await page.goto("/");

    // "M" brand icon lives inside a rounded-md div in the header
    await expect(
      page.locator("header").getByText("M", { exact: true }),
    ).toBeVisible();

    // Full brand name in header
    await expect(
      page.locator("header").getByText("墨染 MoRan"),
    ).toBeVisible();
  });

  test("renders user menu in header", async ({ page }) => {
    await mockProjectListEmpty(page);
    await page.goto("/");

    // UserMenu renders Avatar with AvatarFallback "U" inside a button in the header
    await expect(
      page.locator("header").getByRole("button", { name: /U/i }),
    ).toBeVisible();
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  test("shows empty state when no projects", async ({ page }) => {
    await mockProjectListEmpty(page);
    await page.goto("/");

    // Wait for the empty state heading to appear (projects loaded, list empty)
    await expect(page.getByRole("heading", { name: "还没有项目" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("告诉墨衡你想写什么故事吧")).toBeVisible();
  });

  test("shows example prompts in empty state", async ({ page }) => {
    await mockProjectListEmpty(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "还没有项目" })).toBeVisible({
      timeout: 10_000,
    });

    // Three example prompt buttons
    await expect(
      page.getByRole("button", { name: "我想写一本赛博朋克修仙小说" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "来一本末日废土题材的" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "帮我续写上次的故事" }),
    ).toBeVisible();
  });

  // ── With projects ───────────────────────────────────────────────────────────

  test("displays project cards when projects exist", async ({ page }) => {
    await mockProjectList(page, [SAMPLE_PROJECT]);
    await page.goto("/");

    // "我的项目" section heading appears when list is non-empty
    await expect(
      page.getByRole("heading", { name: "我的项目" }),
    ).toBeVisible({ timeout: 10_000 });

    // The sample project card title should be visible
    await expect(page.getByText(SAMPLE_PROJECT.title)).toBeVisible();
  });

  // ── Inline chat input ───────────────────────────────────────────────────────

  test("shows inline chat input with placeholder", async ({ page }) => {
    await mockProjectListEmpty(page);
    await page.goto("/");

    // The sticky-bottom inline chat input is always rendered regardless of project state
    await expect(
      page.getByPlaceholder("告诉墨衡你想写什么故事..."),
    ).toBeVisible({ timeout: 10_000 });
  });
});
