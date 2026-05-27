import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const HELIX = "https://api.twitch.tv/helix";

async function getTwitchAppToken(): Promise<string | null> {
  // Reuse the token cache from twitch.ts via the app_tokens table.
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("app_tokens")
    .select("access_token, expires_at")
    .eq("provider", "twitch")
    .maybeSingle();

  if (data && new Date(data.expires_at).getTime() - Date.now() > 5 * 60 * 1000) {
    return data.access_token;
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json = (await res.json()) as { access_token: string; expires_in: number };
  const expiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString();
  await supabase.from("app_tokens").upsert({
    provider: "twitch",
    access_token: json.access_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });
  return json.access_token;
}

async function getBroadcasterId(channel: string): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const token = await getTwitchAppToken();
  if (!clientId || !token) return null;

  const res = await fetch(`${HELIX}/users?login=${encodeURIComponent(channel)}`, {
    headers: { "Client-Id": clientId, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json = (await res.json()) as { data: Array<{ id: string }> };
  return json.data?.[0]?.id ?? null;
}

/**
 * Ensures stream.online + stream.offline EventSub subscriptions exist for the
 * given channel. Safe to call multiple times — exits early if both subs already
 * exist in the registry. Intended to be called fire-and-forget after a
 * twitch_live widget is saved.
 */
export async function ensureChannelSubscriptions(channel: string): Promise<void> {
  const login = channel.trim().toLowerCase();
  if (!login) return;

  const clientId = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_EVENTSUB_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null);

  if (!clientId || !secret || !siteUrl) return;

  const supabase = createAdminClient();

  const broadcasterId = await getBroadcasterId(login);
  if (!broadcasterId) return;

  // Check if both subscriptions already exist and are enabled.
  const { data: existing } = await supabase
    .from("twitch_eventsub_subscriptions")
    .select("event_type, status")
    .eq("broadcaster_id", broadcasterId)
    .in("event_type", ["stream.online", "stream.offline"]);

  const enabledTypes = new Set(
    (existing ?? []).filter((s) => s.status === "enabled").map((s) => s.event_type)
  );
  if (enabledTypes.has("stream.online") && enabledTypes.has("stream.offline")) return;

  const token = await getTwitchAppToken();
  if (!token) return;

  const callbackUrl = `${siteUrl}/api/webhooks/twitch`;
  const eventTypes = ["stream.online", "stream.offline"].filter((t) => !enabledTypes.has(t));

  for (const type of eventTypes) {
    const res = await fetch(`${HELIX}/eventsub/subscriptions`, {
      method: "POST",
      headers: {
        "Client-Id": clientId,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type,
        version: "1",
        condition: { broadcaster_user_id: broadcasterId },
        transport: { method: "webhook", callback: callbackUrl, secret },
      }),
      cache: "no-store",
    });

    if (res.ok || res.status === 409) {
      // 409 = subscription already exists on Twitch side but not in our registry.
      const json = (await res.json()) as { data?: Array<{ id: string; status: string }> };
      const sub = json.data?.[0];
      if (sub) {
        await supabase.from("twitch_eventsub_subscriptions").upsert({
          id: sub.id,
          broadcaster_id: broadcasterId,
          channel: login,
          event_type: type,
          status: sub.status,
        });
      }
    }
  }
}
