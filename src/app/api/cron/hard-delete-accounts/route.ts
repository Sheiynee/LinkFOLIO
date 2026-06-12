import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit-log";
import { verifyCronSecret } from "@/lib/cron-auth";
import { pruneRateLimitBuckets } from "@/lib/rate-limit";

/**
 * Cron-triggered cleanup of accounts that passed their 30-day grace window.
 * Soft delete happens immediately on user action (see
 * `softDeleteAccount` in `dashboard/settings/account-actions.ts`); this
 * route does the final wipe.
 *
 * Auth: protected by a shared-secret header `CRON_SECRET`. Set the env var
 * on the deploy and configure Vercel Cron (or any external cron) to hit
 * this endpoint with the header. The endpoint will 401 without it.
 *
 * Idempotent — running it twice in the same minute does nothing the second
 * time because the matching profiles are already gone.
 */

export const dynamic = "force-dynamic";

function unauthorized() {
  return new NextResponse("Unauthorized", { status: 401 });
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) return new NextResponse("CRON_SECRET not configured", { status: 500 });
  if (!verifyCronSecret(request.headers.get("authorization"))) return unauthorized();

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Housekeeping piggybacked on the daily cron: drop rate-limit buckets and
  // webhook dedupe rows that have aged out of any window.
  await pruneRateLimitBuckets(60 * 60);
  await supabase
    .from("twitch_webhook_messages")
    .delete()
    .lt("received_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  // Pull every profile whose grace window has expired.
  const { data: expired, error } = await supabase
    .from("profiles")
    .select("id, username")
    .lt("deleted_grace_until", now)
    .not("deleted_grace_until", "is", null);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!expired || expired.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0 });
  }

  let deleted = 0;
  for (const profile of expired) {
    // Remove storage objects first (we can't rely on FK cascades for files).
    const [{ data: fonts }] = await Promise.all([
      supabase.from("user_fonts").select("storage_path").eq("user_id", profile.id),
    ]);
    if (fonts && fonts.length > 0) {
      await supabase.storage
        .from("fonts")
        .remove(fonts.map((f) => f.storage_path).filter(Boolean) as string[]);
    }
    for (const bucket of ["avatars", "backgrounds"]) {
      const { data: list } = await supabase.storage.from(bucket).list(profile.id);
      if (list && list.length > 0) {
        await supabase.storage
          .from(bucket)
          .remove(list.map((row) => `${profile.id}/${row.name}`));
      }
    }

    // Cascade deletes wipe blocks / elements / page_views / fonts rows.
    await supabase.from("profiles").delete().eq("id", profile.id);

    await logAuditEvent("account.hard_delete", {
      userId: profile.id,
      detail: { username: profile.username },
    });
    deleted++;
  }

  return NextResponse.json({ ok: true, deleted });
}
