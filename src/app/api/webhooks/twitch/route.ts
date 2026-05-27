import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

const MESSAGE_TYPE_HEADER = "twitch-eventsub-message-type";
const MESSAGE_ID_HEADER = "twitch-eventsub-message-id";
const MESSAGE_TIMESTAMP_HEADER = "twitch-eventsub-message-timestamp";
const MESSAGE_SIGNATURE_HEADER = "twitch-eventsub-message-signature";
const MAX_MESSAGE_AGE_MS = 10 * 60 * 1000; // 10 minutes

function verifySignature(
  secret: string,
  msgId: string,
  msgTimestamp: string,
  body: string,
  signature: string
): boolean {
  const hmacMessage = msgId + msgTimestamp + body;
  const expected = "sha256=" + createHmac("sha256", secret).update(hmacMessage).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.TWITCH_EVENTSUB_SECRET;
  if (!secret) return new NextResponse("Server misconfiguration", { status: 500 });

  // Read raw body before any parsing — HMAC must cover the exact bytes Twitch sent.
  const rawBody = await request.text();

  const msgId = request.headers.get(MESSAGE_ID_HEADER) ?? "";
  const msgTimestamp = request.headers.get(MESSAGE_TIMESTAMP_HEADER) ?? "";
  const msgSignature = request.headers.get(MESSAGE_SIGNATURE_HEADER) ?? "";
  const msgType = request.headers.get(MESSAGE_TYPE_HEADER) ?? "";

  // Verify HMAC signature.
  if (!verifySignature(secret, msgId, msgTimestamp, rawBody, msgSignature)) {
    await logAuditEvent("twitch.webhook_rejected", { detail: { reason: "bad_signature" } });
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Replay guard — reject messages older than 10 minutes.
  const messageAge = Date.now() - new Date(msgTimestamp).getTime();
  if (messageAge > MAX_MESSAGE_AGE_MS) {
    return new NextResponse("Gone", { status: 410 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  // Challenge verification — Twitch sends this when a new subscription is created.
  if (msgType === "webhook_callback_verification") {
    const challenge = (body as { challenge?: string }).challenge;
    if (!challenge) return new NextResponse("Bad Request", { status: 400 });
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const supabase = createAdminClient();

  if (msgType === "notification") {
    const subscriptionType = (body as { subscription?: { type?: string } }).subscription?.type;
    const event = (body as { event?: Record<string, unknown> }).event;

    if (subscriptionType === "stream.online" && event) {
      const channel = String(event.broadcaster_user_login ?? "").toLowerCase();
      const broadcasterId = String(event.broadcaster_user_id ?? "");
      if (channel) {
        await supabase.from("creator_live_status").upsert({
          channel,
          broadcaster_id: broadcasterId,
          is_live: true,
          stream_title: String(event.title ?? ""),
          game_name: String(event.category_name ?? event.game_name ?? ""),
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } else if (subscriptionType === "stream.offline" && event) {
      const channel = String(event.broadcaster_user_login ?? "").toLowerCase();
      const broadcasterId = String(event.broadcaster_user_id ?? "");
      if (channel) {
        await supabase.from("creator_live_status").upsert({
          channel,
          broadcaster_id: broadcasterId,
          is_live: false,
          stream_title: null,
          game_name: null,
          viewer_count: null,
          started_at: null,
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  if (msgType === "revocation") {
    const sub = (body as { subscription?: { id?: string; status?: string } }).subscription;
    if (sub?.id) {
      await supabase
        .from("twitch_eventsub_subscriptions")
        .update({ status: sub.status ?? "revoked" })
        .eq("id", sub.id);
      await logAuditEvent("twitch.subscription_revoked", { detail: { subscription_id: sub.id, status: sub.status } });
    }
  }

  return new NextResponse(null, { status: 200 });
}
