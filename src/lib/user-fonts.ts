import { createAdminClient } from "./supabase/admin";
import type { UserFontRecord } from "./typography";

/**
 * Look up user_fonts rows by id. Used by the public page to resolve
 * font references in the theme + per-block overrides.
 */
export async function getUserFontsByIds(ids: string[]): Promise<UserFontRecord[]> {
  if (ids.length === 0) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_fonts")
    .select("id, family_name, weight, style, url")
    .in("id", ids);
  if (error || !data) return [];
  return data as UserFontRecord[];
}

/** Look up all user_fonts owned by a user. Used by the dashboard editor. */
export async function getUserFontsForUser(userId: string): Promise<UserFontRecord[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_fonts")
    .select("id, family_name, weight, style, url, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as UserFontRecord[];
}

/** Sum of byte sizes for a user's uploaded fonts. */
export async function getUserFontUsageBytes(userId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_fonts")
    .select("size_bytes")
    .eq("user_id", userId);
  if (error || !data) return 0;
  return data.reduce((sum, row) => sum + (row.size_bytes ?? 0), 0);
}
