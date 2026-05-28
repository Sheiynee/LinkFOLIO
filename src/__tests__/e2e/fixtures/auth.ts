/**
 * Playwright auth fixture.
 *
 * Injects a valid NextAuth v5 session cookie so tests can reach authenticated
 * routes without going through the real OAuth flow.
 *
 * Required env vars (skip authenticated tests if absent):
 *   AUTH_SECRET   — same value as in .env (used to sign the JWT)
 *   E2E_USER_ID   — Supabase user ID of the test account
 *   E2E_USERNAME  — the username slug of the test account
 */
import { test as base, expect, type Page } from "@playwright/test";

const AUTH_COOKIE = "authjs.session-token";

export { expect };

export async function injectSession(page: Page) {
  const userId = process.env.E2E_USER_ID;
  const secret = process.env.AUTH_SECRET;
  if (!userId || !secret) return false;

  // next-auth/jwt encode creates a signed JWT that NextAuth v5 accepts.
  const { encode } = await import("next-auth/jwt");
  const token = await encode({
    token: { sub: userId },
    secret,
    salt: AUTH_COOKIE,
  });

  await page.context().addCookies([
    {
      name: AUTH_COOKIE,
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
  return true;
}

/** Use this instead of the base `test` for any test that needs auth. */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    const ok = await injectSession(page);
    if (!ok) {
      base.skip(
        true,
        "AUTH_SECRET and E2E_USER_ID must be set to run authenticated E2E tests"
      );
    }
    await use(page);
  },
});
