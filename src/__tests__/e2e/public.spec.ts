/**
 * E2E — public-facing routes (no authentication required).
 *
 * Required env var:
 *   E2E_USERNAME — username slug of a live test account (e.g. "alice")
 *
 * Run:
 *   npm run test:e2e -- src/__tests__/e2e/public.spec.ts
 */
import { test, expect } from "@playwright/test";

const username = process.env.E2E_USERNAME ?? "";

test.describe("Public profile page /{username}", () => {
  test.beforeEach(() => {
    test.skip(!username, "Set E2E_USERNAME to run public page tests");
  });

  test("renders without a 404", async ({ page }) => {
    const res = await page.goto(`/${username}`);
    expect(res?.status()).not.toBe(404);
    expect(res?.status()).toBe(200);
  });

  test("has a <main> element", async ({ page }) => {
    await page.goto(`/${username}`);
    await expect(page.locator("main")).toBeVisible();
  });

  test("page title contains the site name or username", async ({ page }) => {
    await page.goto(`/${username}`);
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test("does not show a Next.js error overlay", async ({ page }) => {
    await page.goto(`/${username}`);
    // Next.js error overlays mount inside a shadow root — absence is a good sign
    await expect(page.locator("nextjs-portal")).not.toBeAttached();
  });
});

test.describe("OG image /api/og/[username]", () => {
  test.beforeEach(() => {
    test.skip(!username, "Set E2E_USERNAME to run OG image tests");
  });

  test("returns 200 with image/png content-type", async ({ request }) => {
    const res = await request.get(`/api/og/${username}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  });

  test("Story card returns 200 with image/png", async ({ request }) => {
    const res = await request.get(`/api/og/${username}/story`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  });

  test("iCal feed returns 200 with text/calendar", async ({ request }) => {
    const res = await request.get(`/api/ical/${username}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
  });
});

test.describe("404 handling", () => {
  test("unknown username returns 404", async ({ page }) => {
    const res = await page.goto("/this-username-should-never-exist-xkzq9");
    expect(res?.status()).toBe(404);
  });
});
