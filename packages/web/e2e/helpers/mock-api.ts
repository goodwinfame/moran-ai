import { Page } from "@playwright/test";

// Mock project list API
export async function mockProjectListEmpty(page: Page) {
  await page.route("**/api/projects", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ projects: [], total: 0 }),
    }),
  );
}

export async function mockProjectList(page: Page, projects: unknown[]) {
  await page.route("**/api/projects", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ projects, total: projects.length }),
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
