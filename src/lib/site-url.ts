/**
 * Canonical site origin, no trailing slash. Single source for the
 * NEXT_PUBLIC_SITE_URL → VERCEL_PROJECT_PRODUCTION_URL → localhost fallback
 * chain that used to be copy-pasted across layouts, actions, and routes.
 */
export function siteBaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return url.replace(/\/$/, "");
}

/**
 * Like siteBaseUrl, but null when no public origin is configured — for
 * callers that must NOT fall back to localhost (e.g. registering Twitch
 * webhook callbacks).
 */
export function productionSiteUrl(): string | null {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null);
  return url ? url.replace(/\/$/, "") : null;
}
