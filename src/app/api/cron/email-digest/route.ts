import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWeeklyDigest } from "@/lib/email";
import { logAuditEvent } from "@/lib/audit-log";
import { verifyCronSecret } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

function unauthorized() {
  return new NextResponse("Unauthorized", { status: 401 });
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) return new NextResponse("CRON_SECRET not configured", { status: 500 });
  if (!verifyCronSecret(request.headers.get("authorization"))) return unauthorized();

  const supabase = createAdminClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all opted-in, non-deleted profiles with their email from next_auth.
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("email_digest_opted_in", true)
    .is("deleted_at", null);

  if (profilesError) {
    return NextResponse.json({ ok: false, error: profilesError.message }, { status: 500 });
  }
  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;
  let failed = 0;

  for (const profile of profiles) {
    try {
      // Get user email via RPC (crosses next_auth schema boundary).
      const { data: emailRow } = await supabase.rpc("get_user_email", { p_user_id: profile.id });
      if (!emailRow) continue;

      // Aggregate views and clicks for the past 7 days from materialized views.
      const weekAgoDate = weekAgo.slice(0, 10);

      // Fetch block IDs owned by this user first (needed to filter clicks).
      const { data: ownedBlocks } = await supabase
        .from("blocks")
        .select("id")
        .eq("user_id", profile.id);
      const ownedIds = new Set((ownedBlocks ?? []).map((b) => b.id));

      const [{ data: viewsData }, { data: clicksData }] = await Promise.all([
        supabase
          .from("mv_page_views_daily")
          .select("views")
          .eq("profile_id", profile.id)
          .gte("day", weekAgoDate),
        supabase
          .from("mv_block_clicks_daily")
          .select("clicks, block_id")
          .in("block_id", Array.from(ownedIds))
          .gte("day", weekAgoDate),
      ]);

      const views = (viewsData ?? []).reduce((s, r) => s + (r.views ?? 0), 0);
      const clicks = (clicksData ?? []).reduce((s, r) => s + (r.clicks ?? 0), 0);

      await sendWeeklyDigest(emailRow, {
        views,
        clicks,
        username: profile.username,
      });

      await logAuditEvent("account.digest_sent", { userId: profile.id });
      sent++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ ok: true, sent, failed });
}
