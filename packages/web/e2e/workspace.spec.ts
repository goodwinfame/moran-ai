import { test, expect } from "@playwright/test";
import { setAuthCookie, mockWorkspaceApis } from "./helpers/mock-api";

const PROJECT_ID = "test-project-1";

/**
 * Workspace Page E2E Tests (V2)
 *
 * Tests cover the split-layout workspace at `/projects/:id`.
 * The route is protected by Next.js middleware (matcher: ["/projects/:path*"]).
 * Each test sets the session_id cookie and mocks all workspace API calls.
 *
 * Key V2 data-testid attributes:
 * - "workspace-container" — outermost flex container
 * - "left-panel"          — ChatPanel side
 * - "right-panel"         — InfoPanel side
 * - "resizable-splitter"  — drag handle between panels
 * - "info-panel"          — InfoPanel root div
 *
 * Note on tabs: The TabBar inside InfoPanel only renders when visibleTabs[] is
 * non-empty, which happens only via incoming SSE events from the backend.
 * Initial page load with mocked (empty) SSE shows the InfoPanel's EmptyState
 * rather than the TabBar.
 */
test.describe("Workspace Page", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // Authenticate by injecting the session cookie before navigation
    await setAuthCookie(page, baseURL!);
    // Intercept all API calls made during workspace initialisation
    await mockWorkspaceApis(page, PROJECT_ID);
  });

  // ── Layout structure ────────────────────────────────────────────────────────

  test("renders split layout with left and right panels", async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}`);

    await expect(page.getByTestId("workspace-container")).toBeVisible();
    await expect(page.getByTestId("left-panel")).toBeVisible();
    await expect(page.getByTestId("right-panel")).toBeVisible();
  });

  test("shows resizable splitter between panels", async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}`);

    // ResizableSplitter renders a div with data-testid="resizable-splitter"
    await expect(page.getByTestId("resizable-splitter")).toBeVisible();
  });

  // ── Left panel (ChatPanel) ──────────────────────────────────────────────────

  test("left panel contains chat area", async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}`);

    const leftPanel = page.getByTestId("left-panel");
    await expect(leftPanel).toBeVisible();

    // ChatNavBar always renders a back-navigation button (arrow_back icon)
    // and the project emoji "📖". Assert the panel region contains the nav bar.
    // We look for the back button via its accessible role inside the left panel.
    await expect(
      leftPanel.getByRole("button").first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ── Right panel (InfoPanel) ─────────────────────────────────────────────────

  test("right panel contains info panel", async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}`);

    const rightPanel = page.getByTestId("right-panel");
    await expect(rightPanel).toBeVisible();

    // InfoPanel root is always present inside the right panel
    await expect(rightPanel.getByTestId("info-panel")).toBeVisible();
  });
});
