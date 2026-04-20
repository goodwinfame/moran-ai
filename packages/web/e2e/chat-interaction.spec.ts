import { test, expect } from "@playwright/test";
import {
  mockProjectListEmpty,
  mockInlineChatApis,
  mockInlineChatError,
  mockInlineChatHangingSession,
  mockInlineChatMultiRound,
} from "./helpers/mock-api";

/**
 * Inline Chat Interaction E2E Tests (V2)
 *
 * Tests cover the inline chat flow on the project-list page at `/`.
 *
 * Flow:
 *   User fills input → presses Enter (or clicks send) →
 *   store sets isSending=true → GET /api/chat/session →
 *   EventSource opens to /api/chat/events?sessionId=... →
 *   onopen → POST /api/chat/send →
 *   text event → accumulatedText grows →
 *   message_complete → assistant bubble renders, isSending=false
 */
test.describe("Inline Chat Interaction", () => {
  // ── Test 1: sends message and receives AI response ──────────────────────────

  test("sends message and receives AI response", async ({ page }) => {
    const responseText = "你好，我是墨衡！有什么可以帮你的？";

    await mockProjectListEmpty(page);
    await mockInlineChatApis(page, responseText);
    await page.goto("/");

    // Wait for page to settle with empty state visible
    await expect(page.getByRole("heading", { name: "还没有项目" })).toBeVisible({
      timeout: 10_000,
    });

    // Fill input and submit
    await page.getByPlaceholder("告诉墨衡你想写什么故事...").fill("你好");
    await page.keyboard.press("Enter");

    // User bubble should appear (justify-end, bg-primary)
    await expect(page.getByText("你好").first()).toBeVisible({ timeout: 15_000 });

    // Assistant bubble should appear with full response text
    await expect(page.getByText(responseText)).toBeVisible({ timeout: 15_000 });
  });

  // ── Test 2: sends message via send button click ─────────────────────────────

  test("sends message via send button click", async ({ page }) => {
    const responseText = "好的，让我们一起创作一本精彩的科幻小说！";

    await mockProjectListEmpty(page);
    await mockInlineChatApis(page, responseText);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "还没有项目" })).toBeVisible({
      timeout: 10_000,
    });

    // Fill input, then click the send button (sr-only text "发送")
    await page.getByPlaceholder("告诉墨衡你想写什么故事...").fill("写一本科幻小说");
    await page.getByRole("button", { name: "发送" }).click();

    // User bubble appears
    await expect(page.getByText("写一本科幻小说").first()).toBeVisible({ timeout: 15_000 });

    // AI response bubble appears
    await expect(page.getByText(responseText)).toBeVisible({ timeout: 15_000 });
  });

  // ── Test 3: shows disabled state while sending ──────────────────────────────

  test("shows disabled state while sending", async ({ page }) => {
    await mockProjectListEmpty(page);
    // Mock session to hang — keeps isSending=true indefinitely
    await mockInlineChatHangingSession(page);
    await page.goto("/");

    await expect(page.getByPlaceholder("告诉墨衡你想写什么故事...")).toBeVisible({
      timeout: 10_000,
    });

    // Submit message
    await page.getByPlaceholder("告诉墨衡你想写什么故事...").fill("你好");
    await page.keyboard.press("Enter");

    // While isSending=true, placeholder changes to "墨衡思考中..."
    // This happens synchronously before the session request is made
    await expect(page.getByPlaceholder("墨衡思考中...")).toBeVisible({ timeout: 5_000 });

    // The original placeholder should no longer be visible
    await expect(page.getByPlaceholder("告诉墨衡你想写什么故事...")).not.toBeVisible();
  });

  // ── Test 4: handles SSE error event ─────────────────────────────────────────

  test("handles SSE error event", async ({ page }) => {
    const errorMessage = "AI 服务暂时不可用";

    await mockProjectListEmpty(page);
    await mockInlineChatError(page, errorMessage);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "还没有项目" })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByPlaceholder("告诉墨衡你想写什么故事...").fill("你好");
    await page.keyboard.press("Enter");

    // User bubble appears first
    await expect(page.getByText("你好").first()).toBeVisible({ timeout: 15_000 });

    // Error message appears in an assistant bubble
    await expect(page.getByText(errorMessage)).toBeVisible({ timeout: 15_000 });
  });

  // ── Test 5: displays max 3 rounds of conversation ──────────────────────────

  test("displays max 3 rounds of conversation", async ({ page }) => {
    await mockProjectListEmpty(page);
    await mockInlineChatMultiRound(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "还没有项目" })).toBeVisible({
      timeout: 10_000,
    });

    const input = page.getByPlaceholder("告诉墨衡你想写什么故事...");

    // Round 1
    await input.fill("消息1");
    await page.keyboard.press("Enter");
    await expect(page.getByText("回复1")).toBeVisible({ timeout: 15_000 });

    // Round 2 — input re-enabled after isSending goes false
    await input.fill("消息2");
    await page.keyboard.press("Enter");
    await expect(page.getByText("回复2")).toBeVisible({ timeout: 15_000 });

    // Round 3
    await input.fill("消息3");
    await page.keyboard.press("Enter");
    await expect(page.getByText("回复3")).toBeVisible({ timeout: 15_000 });

    // Round 4 — oldest pair (消息1/回复1) should be trimmed
    await input.fill("消息4");
    await page.keyboard.press("Enter");
    await expect(page.getByText("回复4")).toBeVisible({ timeout: 15_000 });

    // After 4 rounds (8 messages), only the last 6 are kept
    // 消息1 and 回复1 are trimmed out
    await expect(page.getByText("消息1")).not.toBeVisible();
    await expect(page.getByText("回复1")).not.toBeVisible();

    // Rounds 2, 3, 4 remain visible
    await expect(page.getByText("消息2")).toBeVisible();
    await expect(page.getByText("消息3")).toBeVisible();
    await expect(page.getByText("消息4")).toBeVisible();
  });

  // ── Test 6: clicking example prompt fills input ─────────────────────────────

  test("clicking example prompt fills input", async ({ page }) => {
    await mockProjectListEmpty(page);
    await page.goto("/");

    // Wait for empty state with example prompts
    await expect(page.getByRole("heading", { name: "还没有项目" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole("button", { name: "我想写一本赛博朋克修仙小说" }),
    ).toBeVisible();

    // Click the example prompt button
    await page.getByRole("button", { name: "我想写一本赛博朋克修仙小说" }).click();

    // Input should be filled with the prompt text
    await expect(page.getByPlaceholder("告诉墨衡你想写什么故事...")).toHaveValue(
      "我想写一本赛博朋克修仙小说",
    );

    // Input should have focus (handleExampleClick calls inputRef.current.focus())
    await expect(page.getByPlaceholder("告诉墨衡你想写什么故事...")).toBeFocused();
  });
});
