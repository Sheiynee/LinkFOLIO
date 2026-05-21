"use server";

import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { subtractStorageUsage } from "@/lib/storage-quota";
import { logAuditEvent } from "@/lib/audit-log";

const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Soft-delete the current account. Sets `profiles.deleted_at` + a
 * `deleted_grace_until` 30 days in the future. The cleanup cron (set up in
 * a later phase) actually wipes rows after the grace window; until then the
 * user can call `cancelAccountDeletion` to undo. The username stays
 * reserved during the grace period — `profiles.username` keeps its value,
 * so signing back in restores access.
 */
export async function softDeleteAccount() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  const now = new Date();
  const graceUntil = new Date(now.getTime() + GRACE_PERIOD_MS);

  const { error } = await supabase
    .from("profiles")
    .update({
      deleted_at: now.toISOString(),
      deleted_grace_until: graceUntil.toISOString(),
    })
    .eq("id", session.user.id);
  if (error) return { error: error.message };

  await logAuditEvent("account.soft_delete", {
    userId: session.user.id,
    detail: { grace_until: graceUntil.toISOString() },
  });

  revalidatePath("/dashboard");
  return { ok: true, graceUntil: graceUntil.toISOString() };
}

export async function cancelAccountDeletion() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ deleted_at: null, deleted_grace_until: null })
    .eq("id", session.user.id);
  if (error) return { error: error.message };

  await logAuditEvent("account.cancel_delete", { userId: session.user.id });

  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Hard delete — wipes profile, blocks, elements, fonts, uploads. Intended
 * to be called by a maintenance script once the grace period has passed,
 * not directly from the dashboard. Exposed here so the same code path can
 * be reused for "delete immediately" if the user requests it.
 */
export async function hardDeleteAccount() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();

  // Remove storage objects first so the row deletions don't strand files.
  const [{ data: fonts }, { data: profile }] = await Promise.all([
    supabase.from("user_fonts").select("storage_path, size_bytes").eq("user_id", session.user.id),
    supabase.from("profiles").select("username, avatar_url").eq("id", session.user.id).maybeSingle(),
  ]);

  if (fonts && fonts.length > 0) {
    await supabase.storage.from("fonts").remove(fonts.map((f) => f.storage_path).filter(Boolean) as string[]);
  }
  // Storage listing for prefix removal (avatars, backgrounds, element-images).
  const folders: Array<{ bucket: string; prefix: string }> = [
    { bucket: "avatars", prefix: `${session.user.id}/` },
    { bucket: "backgrounds", prefix: `${session.user.id}/` },
  ];
  for (const f of folders) {
    const { data: list } = await supabase.storage.from(f.bucket).list(f.prefix.replace(/\/$/, ""));
    if (list && list.length > 0) {
      await supabase.storage.from(f.bucket).remove(list.map((row) => `${f.prefix}${row.name}`));
    }
  }

  // Row deletions — `on delete cascade` chains take care of blocks /
  // elements / page_views / block_clicks / user_fonts / user_storage.
  await supabase.from("profiles").delete().eq("id", session.user.id);
  // Reset storage counter for safety (FK cascade should already cover it).
  await subtractStorageUsage(session.user.id, Number.MAX_SAFE_INTEGER);

  void profile; // silence unused (kept for future audit logging)
  redirect("/");
}

/**
 * GDPR-style JSON dump of everything we hold for this user. Returns a
 * single object suitable for downloading directly from the browser.
 */
export async function exportUserData(): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  const userId = session.user.id;

  const [
    { data: profile },
    { data: blocks },
    { data: elements },
    { data: userFonts },
    { data: pageViews },
    { data: blockClicks },
    { data: storage },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("blocks").select("*").eq("user_id", userId),
    supabase.from("elements").select("*").eq("user_id", userId),
    supabase.from("user_fonts").select("*").eq("user_id", userId),
    supabase.from("page_views").select("*").eq("profile_id", userId),
    supabase.from("block_clicks").select("*"),
    supabase.from("user_storage").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  // block_clicks isn't keyed by user_id directly; filter by ownership.
  const ownedBlockIds = new Set((blocks ?? []).map((b) => b.id));
  const ownedClicks = (blockClicks ?? []).filter((c) => ownedBlockIds.has(c.block_id));

  await logAuditEvent("account.export", { userId });

  return {
    ok: true,
    data: {
      exported_at: new Date().toISOString(),
      profile,
      blocks,
      elements,
      user_fonts: userFonts,
      page_views: pageViews,
      block_clicks: ownedClicks,
      storage,
    },
  };
}
