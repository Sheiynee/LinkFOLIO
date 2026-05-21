import type { MetadataRoute } from "next";

const siteBase =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

/**
 * Robots policy. Public profile pages are crawlable so they get indexed —
 * that's the whole point of LinkFolio being a creator hub. Dashboard,
 * onboarding, auth callbacks, and the redirect endpoint are all walled
 * off because crawlers shouldn't follow click-tracking redirects.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/onboarding", "/auth", "/r/", "/api/"],
      },
    ],
    sitemap: `${siteBase.replace(/\/$/, "")}/sitemap.xml`,
  };
}
