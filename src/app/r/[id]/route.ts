import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BOT_REGEX = /bot|crawler|spider|crawling|preview|facebookexternalhit|whatsapp|slackbot|discordbot|twitterbot/i;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();

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
    void supabase
      .from("block_clicks")
      .insert({ block_id: params.id, referrer, country })
      .then(() => {});
  }

  return NextResponse.redirect(block.url, { status: 302 });
}
