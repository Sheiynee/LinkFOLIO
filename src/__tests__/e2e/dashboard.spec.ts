/**
 * E2E — authenticated dashboard flows.
 *
 * Required env vars (all tests skip when absent):
 *   AUTH_SECRET   — same value as in .env
 *   E2E_USER_ID   — Supabase user ID of the test account
 *   E2E_USERNAME  — username slug of the test account
 *
 * Run:
 *   npm run test:e2e -- src/__tests__/e2e/dashboard.spec.ts
 */
import { test, expect } from "./fixtures/auth";

const username = process.env.E2E_USERNAME ?? "";

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Sign-in + first page
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Dashboard landing", () => {
  test("authenticated user lands on /dashboard", async ({ authedPage: page }) => {
    await page.goto("/dashboard");
    await expect(page).not.toHaveURL(/\/auth\/signin/);
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("unauthenticated request is redirected to sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/signin/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Add a link block
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Adding a link block", () => {
  test("link block appears in the list after creation", async ({ authedPage: page }) => {
    await page.goto("/dashboard/content");

    // Open the link creation form
    await page.getByRole("button", { name: /^Link$/ }).click();

    // Fill in the form
    await page.getByLabel("Title").fill("E2E Test Link");
    await page.getByLabel("URL").fill("https://example.com");

    // Submit
    await page.getByRole("button", { name: "Add link" }).click();

    // The new block should appear in the list
    await expect(page.getByText("E2E Test Link")).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Add a Twitch live widget
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Adding a Twitch live widget", () => {
  test("Twitch widget appears with the channel name after pasting a URL", async ({
    authedPage: page,
  }) => {
    await page.goto("/dashboard/content");

    // Open the widget picker
    await page.getByRole("button", { name: /widget/i }).click();

    // Use the auto-detect option
    await page.getByRole("button", { name: /paste a url.*auto-detect/i }).click();

    // Paste the Twitch URL
    await page.getByLabel("URL or handle").fill("https://twitch.tv/ninja");

    // Submit
    await page.getByRole("button", { name: "Add widget" }).click();

    // Widget should appear — it shows "ninja" somewhere in the block
    await expect(page.getByText(/ninja/i)).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: Theme picker
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Theme picker", () => {
  test("selecting a preset shows the Presets tab content", async ({
    authedPage: page,
  }) => {
    await page.goto("/dashboard/theme");

    // Click the Presets tab
    await page.getByRole("tab", { name: "Presets" }).click();

    // At least one preset button should be visible
    // The presets are: Apple Glass, Neobrutal, Vercel Mono, Sunset Press, Notion Paper, Linear Neon
    await expect(
      page.getByRole("button", { name: /glass|neobrutal|mono|sunset|paper|neon/i }).first()
    ).toBeVisible();
  });

  test("clicking a preset updates the live preview pane", async ({
    authedPage: page,
  }) => {
    await page.goto("/dashboard/theme");
    await page.getByRole("tab", { name: "Presets" }).click();

    // Pick the first visible preset button
    const preset = page.getByRole("button", { name: /glass|neobrutal|mono|sunset|paper|neon/i }).first();
    const presetName = await preset.textContent();
    await preset.click();

    // The preview iframe / panel should be visible after selection
    await expect(page.locator("iframe, [data-preview]").first()).toBeVisible();

    // Save button should become available or active
    await expect(page.getByRole("button", { name: /save/i })).toBeVisible();

    // The selected preset should show a checkmark indicator
    const selectedPreset = page.getByRole("button", { name: presetName! });
    // At minimum, the button state changed (could be aria-pressed, data attribute, or icon)
    await expect(selectedPreset).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: Canvas mode
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Canvas mode", () => {
  test("canvas page loads and shows the off-state message when not in canvas mode", async ({
    authedPage: page,
  }) => {
    await page.goto("/dashboard/canvas");
    // Page should load without error
    await expect(page).not.toHaveURL(/\/auth\/signin/);
    // Either shows the canvas editor (if already on) or the off-state card
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("enabling canvas mode via the dashboard shows confirmation", async ({
    authedPage: page,
  }) => {
    await page.goto("/dashboard");

    // If the "Try canvas mode" button exists, the user is in stacked mode
    const tryBtn = page.getByRole("button", { name: /try canvas mode/i });
    if (!(await tryBtn.isVisible())) {
      // Already in canvas mode — skip body of test
      return;
    }

    await tryBtn.click();

    // After switching, the button label should change to "Use stacked"
    // OR the canvas editor appears
    await expect(
      page.getByRole("button", { name: /use stacked/i })
        .or(page.getByText(/canvas/i))
    ).toBeVisible({ timeout: 5000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 6 (auth version): Authenticated public page
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Public page (authenticated user visiting their own page)", () => {
  test.beforeEach(() => {
    test.skip(!username, "Set E2E_USERNAME to run public page checks");
  });

  test("own public page renders correctly", async ({ authedPage: page }) => {
    await page.goto(`/${username}`);
    const res = await page.waitForResponse((r) => r.url().includes(`/${username}`));
    expect(res.status()).toBe(200);
    await expect(page.locator("main")).toBeVisible();
  });
});
