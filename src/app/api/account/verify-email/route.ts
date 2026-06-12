import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit-log";
import { hashEmailToken } from "@/lib/email-tokens";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return redirect("/dashboard/settings?email_error=invalid");

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Tokens are stored hashed (see lib/email-tokens.ts) — hash the incoming
  // value for the lookup so a DB leak can't be replayed here.
  const { data: row, error } = await supabase
    .from("email_change_tokens")
    .select("id, user_id, new_email")
    .eq("token", hashEmailToken(token))
    .gt("expires_at", now)
    .is("used_at", null)
    .single();

  if (error || !row) return redirect("/dashboard/settings?email_error=expired");

  const { error: rpcError } = await supabase.rpc("update_user_email", {
    p_user_id: row.user_id,
    p_new_email: row.new_email,
  });
  if (rpcError) return redirect("/dashboard/settings?email_error=failed");

  await supabase
    .from("email_change_tokens")
    .update({ used_at: now })
    .eq("id", row.id);

  await logAuditEvent("account.email_changed", { userId: row.user_id });

  return redirect("/dashboard/settings?email_changed=1");
}

function redirect(url: string) {
  return NextResponse.redirect(new URL(url, process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
}
