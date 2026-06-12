import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, RL_REDIRECT } from "@/lib/rate-limit";
import { deferWrite } from "@/lib/defer";

// Run at the edge — `/r/{id}` is the hottest path and benefits from
// sub-100ms global redirects. Supabase JS v2 + the rate-limit lib both
// rely on `fetch`, which is the edge runtime's native API.
export const runtime = "edge";

const BOT_REGEX = /bot|crawler|spider|crawling|preview|facebookexternalhit|whatsapp|slackbot|discordbot|twitterbot/i;

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const real = request.headers.get("x-real-ip");
  return (forwarded?.split(",")[0]?.trim() || real || "anon").toLowerCase();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();

  // Rate-limit anonymous click traffic per IP before we hit the DB. Bots are
  // also rate-limited so a runaway crawler can't burn through our budget.
  const rl = await rateLimit(clientKey(request), RL_REDIRECT);
  if (!rl.allowed) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfterSeconds) },
    });
  }

  const { data: block } = await supabase
    .from("blocks")
    .select("url, type, visible")
    .eq("id", params.id)
    .maybeSingle();

  if (!block || block.type !== "link" || !block.url || !block.visible) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const ua = request.headers.get("user-agent") ?? "";
  const isBot = BOT_REGEX.test(ua);

  if (!isBot) {
    const referrer = request.headers.get("referer");
    const country = request.headers.get("x-vercel-ip-country");
    // waitUntil keeps the edge function alive past the redirect response —
    // a bare `void insert` could be frozen mid-flight and dropped.
    deferWrite(
      Promise.resolve(
        supabase.from("block_clicks").insert({ block_id: params.id, referrer, country })
      )
    );
  }

  return NextResponse.redirect(block.url, { status: 302 });
}
