import { test, expect } from "@playwright/test";

test.describe("Writing Panels", () => {
  const projectId = "test-project-1";

  test("read panel shows chapter list sidebar", async ({ page }) => {
    await page.goto(`/projects/${projectId}/read`);
    await expect(page.getByText("章节列表")).toBeVisible();
  });

  test("write panel shows top control bar", async ({ page }) => {
    await page.goto(`/projects/${projectId}/write`);
    // WriteControls + ConnectionIndicator are always rendered in top bar
    await expect(
      page.locator("div.flex.items-center.justify-between").first(),
    ).toBeVisible();
  });

  test("review panel shows empty state with guidance text", async ({
    page,
  }) => {
    await page.goto(`/projects/${projectId}/review`);
    await expect(page.getByText("审校章节")).toBeVisible();
    await expect(page.getByText("选择左侧章节查看审校报告")).toBeVisible();
    await expect(
      page.getByText("写作完成后，明镜会自动审校每个章节"),
    ).toBeVisible();
  });

  test("manage panel shows dashboard header", async ({ page }) => {
    await page.goto(`/projects/${projectId}/manage`);
    await expect(page.getByText("项目管理")).toBeVisible();
    await expect(
      page.getByText("写作进度、成本、记忆健康状况一目了然"),
    ).toBeVisible();
  });

  test("analysis panel shows empty state with nine-dimension title", async ({
    page,
  }) => {
    await page.goto(`/projects/${projectId}/analysis`);
    await expect(page.getByText("分析历史")).toBeVisible();
    await expect(page.getByText("九维深度分析")).toBeVisible();
    await expect(
      page.getByText(/选择一条历史记录查看详情/),
    ).toBeVisible();
  });

  test("settings panel shows 4 setting tabs", async ({ page }) => {
    await page.goto(`/projects/${projectId}/settings`);
    const tabs = ["世界观", "角色", "大纲", "文风"];
    for (const tab of tabs) {
      await expect(
        page.locator("button", { hasText: tab }),
      ).toBeVisible();
    }
  });

  test("visualize panel shows 3 visualization tabs", async ({ page }) => {
    await page.goto(`/projects/${projectId}/visualize`);
    const tabs = ["事件时间线", "地点层级", "人物关系"];
    for (const tab of tabs) {
      await expect(
        page.locator("button", { hasText: tab }),
      ).toBeVisible();
    }
  });
});
