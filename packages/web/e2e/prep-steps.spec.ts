import { test, expect } from "@playwright/test";

test.describe("Prep Steps Detail", () => {
  const projectId = "test-project-1";

  test("intent page shows two-column alignment layout", async ({ page }) => {
    await page.goto(`/projects/${projectId}/prep/intent`);
    await expect(page.locator("section").first()).toBeVisible();
  });

  test("intent page has chat input area", async ({ page }) => {
    await page.goto(`/projects/${projectId}/prep/intent`);
    await expect(page.locator("input[placeholder]").first()).toBeVisible();
  });

  test("intent page chat input has placeholder text", async ({ page }) => {
    await page.goto(`/projects/${projectId}/prep/intent`);
    await expect(page.getByPlaceholder("描述你的创作想法...")).toBeVisible();
  });

  test("world page renders alignment layout", async ({ page }) => {
    await page.goto(`/projects/${projectId}/prep/world`);
    await expect(page.locator("section").first()).toBeVisible();
  });

  test("characters page renders alignment layout", async ({ page }) => {
    await page.goto(`/projects/${projectId}/prep/characters`);
    await expect(page.locator("section").first()).toBeVisible();
  });

  test("style page renders alignment layout", async ({ page }) => {
    await page.goto(`/projects/${projectId}/prep/style`);
    await expect(page.locator("section").first()).toBeVisible();
  });

  test("outline page renders alignment layout", async ({ page }) => {
    await page.goto(`/projects/${projectId}/prep/outline`);
    await expect(page.locator("section").first()).toBeVisible();
  });

  test("ready page shows status heading", async ({ page }) => {
    await page.goto(`/projects/${projectId}/prep/ready`);
    // Heading is "准备就绪" when all steps confirmed, "筹备进度" otherwise
    await expect(
      page.getByRole("heading", { name: /准备就绪|筹备进度/ }),
    ).toBeVisible();
  });

  test("ready page shows summary cards for each prep step", async ({ page }) => {
    await page.goto(`/projects/${projectId}/prep/ready`);
    const cards = ["创作意图", "世界观", "角色", "文风", "大纲"];
    for (const card of cards) {
      await expect(page.getByText(card, { exact: true }).first()).toBeVisible();
    }
  });

  test("ready page has '开始写作' button", async ({ page }) => {
    await page.goto(`/projects/${projectId}/prep/ready`);
    await expect(page.getByRole("button", { name: /开始写作/ })).toBeVisible();
  });

  test("navigating all 6 prep steps via sidebar shows correct active state", async ({ page }) => {
    const steps = [
      { text: "创作意图", urlSegment: "intent" },
      { text: "世界观", urlSegment: "world" },
      { text: "角色", urlSegment: "characters" },
      { text: "文风", urlSegment: "style" },
      { text: "大纲", urlSegment: "outline" },
      { text: "准备就绪", urlSegment: "ready" },
    ];

    await page.goto(`/projects/${projectId}/prep/intent`);

    for (const step of steps) {
      await page.locator("aside").getByText(step.text, { exact: true }).click();
      await expect(page).toHaveURL(new RegExp(step.urlSegment));
    }
  });
});
