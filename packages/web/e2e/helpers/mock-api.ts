import { Page } from "@playwright/test";

// Mock project list API
export async function mockProjectListEmpty(page: Page) {
  await page.route("**/api/projects", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );
}

export async function mockProjectList(page: Page, projects: unknown[]) {
  await page.route("**/api/projects", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: projects }),
    }),
  );
}

// Sample project data
export const SAMPLE_PROJECT = {
  id: "test-project-1",
  title: "赛博朋克修仙",
  genre: "科幻",
  status: "brainstorm",
  wordCount: 0,
  chapterCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Mock auth endpoints
export async function mockLoginSuccess(page: Page) {
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "ok" }),
    }),
  );
}

export async function mockLoginFail(page: Page, error = "邮箱或密码错误") {
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error }),
    }),
  );
}

export async function mockRegisterSuccess(page: Page) {
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ message: "ok" }),
    }),
  );
}

export async function mockRegisterFail(page: Page, error = "邮箱已注册") {
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error }),
    }),
  );
}

// Mock all API calls that happen on workspace page load
export async function mockWorkspaceApis(page: Page, projectId: string) {
  // Project details — used by ChatNavBar
  await page.route(`**/api/projects/${projectId}`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          id: projectId,
          name: "测试项目",
          title: "测试项目",
          genre: "科幻",
          status: "brainstorm",
          currentChapter: 0,
          chapterCount: 0,
          wordCount: 0,
        },
      }),
    }),
  );

  // SSE subscribe — return empty stream so EventSource settles gracefully
  await page.route(
    `**/api/projects/${projectId}/events/subscribe`,
    (route) =>
      route.fulfill({ status: 200, contentType: "text/event-stream", body: "" }),
  );

  // Token usage summary — used by ChatNavBar
  await page.route(`**/api/projects/${projectId}/usage/summary`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { totalTokens: 0, totalCostUsd: 0, byAgent: {}, byModel: {} },
      }),
    }),
  );

  // Panel data APIs — fetcher uses these exact paths
  const panelEndpoints = [
    "brainstorms",
    "world-settings",
    "worlds",
    "characters",
    "outline",
    "outlines",
    "chapters",
    "reviews",
    "knowledge",
    "agent-status",
  ];
  for (const ep of panelEndpoints) {
    await page.route(`**/api/projects/${projectId}/${ep}**`, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: [] }),
      }),
    );
  }

  // Chat history — used by ChatPanel on mount
  await page.route(`**/api/chat/history**`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );

  // Chat session — used by ChatPanel to connect SSE
  await page.route(`**/api/chat/session**`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { sessionId: "test-session-e2e" } }),
    }),
  );
}

// ── Inline Chat Mocks ──────────────────────────────────────────────────────────

/** Build SSE body from events array */
function buildSSEBody(
  events: Array<{ event: string; data: Record<string, unknown> }>,
): string {
  return (
    events.map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n`).join("\n") + "\n"
  );
}

/** Mock all APIs needed for inline chat interaction */
export async function mockInlineChatApis(page: Page, responseText: string) {
  // 1. Mock /api/chat/session — returns sessionId for SSE connection
  await page.route("**/api/chat/session**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { sessionId: "test-session-inline" } }),
    }),
  );

  // 2. Mock SSE endpoint — returns text + message_complete events
  await page.route("**/api/chat/events**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: buildSSEBody([
        { event: "text", data: { text: responseText } },
        { event: "message_complete", data: {} },
      ]),
    }),
  );

  // 3. Mock /api/chat/send — fire-and-forget POST
  await page.route("**/api/chat/send", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { messageId: "msg-test-1", sessionId: "test-session-inline" },
      }),
    }),
  );
}

/** Mock inline chat APIs that return an error SSE event */
export async function mockInlineChatError(page: Page, errorMessage: string) {
  await page.route("**/api/chat/session**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { sessionId: "test-session-inline" } }),
    }),
  );

  await page.route("**/api/chat/events**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: buildSSEBody([{ event: "error", data: { message: errorMessage } }]),
    }),
  );

  await page.route("**/api/chat/send", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { messageId: "msg-test-1", sessionId: "test-session-inline" },
      }),
    }),
  );
}

/**
 * Mock inline chat APIs where the session endpoint hangs indefinitely.
 * Keeps isSending=true so the disabled state can be verified.
 */
export async function mockInlineChatHangingSession(page: Page) {
  // Never fulfill the session request — leaves the store stuck in isSending=true
  await page.route("**/api/chat/session**", () => {
    // Intentionally no route.fulfill() call
  });
}

/**
 * Mock inline chat APIs with a per-call counter for multi-round tests.
 * Each call to the SSE endpoint returns a response with the round number.
 */
export async function mockInlineChatMultiRound(page: Page) {
  await page.route("**/api/chat/session**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { sessionId: "test-session-inline" } }),
    }),
  );

  let sseCallCount = 0;
  await page.route("**/api/chat/events**", (route) => {
    sseCallCount++;
    const roundNum = sseCallCount;
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: buildSSEBody([
        { event: "text", data: { text: `回复${roundNum}` } },
        { event: "message_complete", data: {} },
      ]),
    });
  });

  await page.route("**/api/chat/send", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { messageId: "msg-test-multi", sessionId: "test-session-inline" },
      }),
    }),
  );
}

// Set session cookie to simulate authenticated user
export async function setAuthCookie(page: Page, baseURL: string) {
  await page.context().addCookies([
    {
      name: "session_id",
      value: "test-session-id-e2e",
      url: baseURL,
    },
  ]);
}
