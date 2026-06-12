"use server";

import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { subtractStorageUsage } from "@/lib/storage-quota";
import { logAuditEvent } from "@/lib/audit-log";
import { sendEmailVerification } from "@/lib/email";
import { hashEmailToken } from "@/lib/email-tokens";
import { siteBaseUrl } from "@/lib/site-url";
import { rateLimit, RL_AUTH } from "@/lib/rate-limit";

const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function requestEmailChange(newEmail: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const rl = await rateLimit(session.user.id, RL_AUTH);
  if (!rl.allowed) return { error: `Too many requests. Try again in ${rl.retryAfterSeconds}s.` };

  const trimmed = newEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { error: "Invalid email address" };

  const supabase = createAdminClient();

  const { data: exists } = await supabase.rpc("email_exists", { p_email: trimmed });
  if (exists) return { error: "That email is already in use" };

  // Generate a 256-bit hex token. Only its hash hits the database; the raw
  // value exists solely inside the verification link we email out.
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const token = Array.from(tokenBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase.from("email_change_tokens").insert({
    user_id: session.user.id,
    new_email: trimmed,
    token: hashEmailToken(token),
    expires_at: expiresAt,
  });
  if (insertError) return { error: "Could not create verification token" };

  const verifyUrl = `${siteBaseUrl()}/api/account/verify-email?token=${token}`;

  try {
    await sendEmailVerification(trimmed, verifyUrl);
  } catch {
    // Don't leak send failures; log and silently succeed so we don't reveal email existence.
  }

  await logAuditEvent("account.email_change_requested", {
    userId: session.user.id,
    detail: { expires_at: expiresAt },
  });

  return { ok: true };
}

export async function updateEmailDigestPreference(optedIn: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ email_digest_opted_in: optedIn })
    .eq("id", session.user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

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

const EXPORT_PAGE_SIZE = 1000;

/**
 * Drain a query past Supabase's default 1000-row response cap. The factory
 * receives an inclusive range and must apply a stable ORDER BY so pages
 * don't overlap.
 */
async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += EXPORT_PAGE_SIZE) {
    const { data } = await page(from, from + EXPORT_PAGE_SIZE - 1);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < EXPORT_PAGE_SIZE) break;
  }
  return out;
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

  // Blocks first — click rows are keyed by block_id, not user_id, so the
  // click query filters on ownership server-side instead of pulling the
  // whole table (which Supabase caps at 1000 rows, silently truncating
  // exports) and filtering in JS.
  const { data: blocks } = await supabase.from("blocks").select("*").eq("user_id", userId);
  const ownedBlockIds = (blocks ?? []).map((b) => b.id);

  const [
    { data: profile },
    { data: elements },
    { data: userFonts },
    pageViews,
    blockClicks,
    { data: storage },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("elements").select("*").eq("user_id", userId),
    supabase.from("user_fonts").select("*").eq("user_id", userId),
    fetchAllRows((from, to) =>
      supabase
        .from("page_views")
        .select("*")
        .eq("profile_id", userId)
        .order("viewed_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    ),
    ownedBlockIds.length === 0
      ? Promise.resolve([])
      : fetchAllRows((from, to) =>
          supabase
            .from("block_clicks")
            .select("*")
            .in("block_id", ownedBlockIds)
            .order("clicked_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to)
        ),
    supabase.from("user_storage").select("*").eq("user_id", userId).maybeSingle(),
  ]);

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
      block_clicks: blockClicks,
      storage,
    },
  };
}
