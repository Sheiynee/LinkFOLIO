import { createAdminClient } from "./supabase/admin";

/**
 * Local fallback list — the DB table is authoritative, but a small hardcoded
 * list lets the username validator short-circuit common cases without hitting
 * the database, and survives DB outages. Keep it in sync with the seed in
 * supabase/14_hardening.sql when adding new entries.
 */
const LOCAL_RESERVED = new Set([
  "admin", "api", "auth", "dashboard", "settings",
  "onboarding", "login", "signup", "signin", "logout",
  "r", "account", "billing", "legal", "terms",
  "privacy", "about", "help", "support", "docs",
  "blog", "press", "jobs", "careers", "status",
  "app", "static", "public", "assets", "img", "images",
  "og", "robots", "sitemap", "favicon", "manifest",
  "linkfolio", "root", "www", "mail", "email",
]);

export function isLocallyReserved(username: string): boolean {
  return LOCAL_RESERVED.has(username.toLowerCase());
}

/**
 * Authoritative check against the `reserved_usernames` table. Falls back to
 * the local list if the query fails so we fail closed (reject the username
 * rather than letting it slip through during a DB hiccup).
 */
export async function isReservedUsername(username: string): Promise<boolean> {
  const normalized = username.trim().toLowerCase();
  if (isLocallyReserved(normalized)) return true;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("reserved_usernames")
      .select("username")
      .eq("username", normalized)
      .maybeSingle();
    return data != null;
  } catch {
    return isLocallyReserved(normalized);
  }
}
