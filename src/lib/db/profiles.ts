import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

const PROFILE_FIELDS =
  "id, username, display_name, bio, avatar_url, theme, layout_mode, verified, deleted_at, deleted_grace_until";

export interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  theme: unknown;
  layout_mode: string | null;
  verified: boolean;
  deleted_at: string | null;
  deleted_grace_until: string | null;
}

// cache() dedupes within one request render — the public page calls
// getProfileByUsername from both generateMetadata and the page component,
// which used to cost two identical queries per visit.
export const getProfileByUsername = cache(async (username: string): Promise<ProfileRow | null> => {
  const { data } = await createAdminClient()
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return data as ProfileRow | null;
});

export const getProfileById = cache(async (userId: string): Promise<ProfileRow | null> => {
  const { data } = await createAdminClient()
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("id", userId)
    .maybeSingle();
  return data as ProfileRow | null;
});
