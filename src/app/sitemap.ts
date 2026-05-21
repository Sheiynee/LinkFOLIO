import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

const siteBase =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

/**
 * Sitemap covers the landing page, legal pages, and every active creator
 * profile (skipping soft-deleted accounts). Re-runs at request time —
 * Next.js memoizes the response for the duration of the request cycle,
 * and Google crawls infrequently enough that this is fine.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteBase.replace(/\/$/, "");
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly" as const, priority: 1 },
    { url: `${base}/legal/terms`, lastModified: now, changeFrequency: "yearly" as const, priority: 0.3 },
    { url: `${base}/legal/privacy`, lastModified: now, changeFrequency: "yearly" as const, priority: 0.3 },
  ];

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("profiles")
      .select("username, updated_at")
      .is("deleted_at", null)
      .limit(10_000);
    const profiles: MetadataRoute.Sitemap = (data ?? []).map((p) => ({
      url: `${base}/${p.username}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));
    return [...staticEntries, ...profiles];
  } catch {
    // DB unavailable at build time? Ship just the static entries — Google
    // will retry on its next crawl.
    return staticEntries;
  }
}
