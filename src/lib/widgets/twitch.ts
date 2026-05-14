import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TwitchLiveData, TwitchVodData } from "./types";

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const HELIX = "https://api.twitch.tv/helix";
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;

async function fetchNewAppToken(): Promise<{ access_token: string; expires_in: number }> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Twitch credentials missing");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    body,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Twitch token request failed: ${res.status}`);
  return res.json();
}

async function getAppToken(): Promise<string> {
  const supabase = createAdminClient();
  const { data: cached } = await supabase
    .from("app_tokens")
    .select("access_token, expires_at")
    .eq("provider", "twitch")
    .maybeSingle();

  if (cached && new Date(cached.expires_at).getTime() - Date.now() > REFRESH_BEFORE_EXPIRY_MS) {
    return cached.access_token;
  }

  const fresh = await fetchNewAppToken();
  const expiresAt = new Date(Date.now() + fresh.expires_in * 1000).toISOString();
  await supabase
    .from("app_tokens")
    .upsert({
      provider: "twitch",
      access_token: fresh.access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });
  return fresh.access_token;
}

async function helix<T>(
  path: string,
  params: Record<string, string>,
  revalidate: number
): Promise<T | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) return null;

  const token = await getAppToken();
  const url = new URL(`${HELIX}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { "Client-Id": clientId, Authorization: `Bearer ${token}` },
    next: { revalidate, tags: ["twitch"] },
  });
  if (res.status === 401) {
    // Token may have been revoked — force refresh on next call by clearing cache.
    const supabase = createAdminClient();
    await supabase.from("app_tokens").delete().eq("provider", "twitch");
    return null;
  }
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

interface HelixUsersResponse {
  data: Array<{
    id: string;
    login: string;
    display_name: string;
    profile_image_url: string;
  }>;
}

interface HelixStreamsResponse {
  data: Array<{
    user_login: string;
    title: string;
    game_name: string;
    viewer_count: number;
    started_at: string;
    thumbnail_url: string;
  }>;
}

export async function getTwitchLiveStatus(channel: string): Promise<TwitchLiveData | null> {
  const login = channel.trim().toLowerCase();
  if (!login) return null;

  const [usersRes, streamsRes] = await Promise.all([
    helix<HelixUsersResponse>("/users", { login }, 60 * 60),
    helix<HelixStreamsResponse>("/streams", { user_login: login }, 30),
  ]);

  const user = usersRes?.data?.[0];
  if (!user) return null;

  const stream = streamsRes?.data?.[0] ?? null;
  return {
    user: {
      id: user.id,
      login: user.login,
      display_name: user.display_name,
      profile_image_url: user.profile_image_url,
    },
    stream: stream
      ? {
          title: stream.title,
          game_name: stream.game_name,
          viewer_count: stream.viewer_count,
          started_at: stream.started_at,
          thumbnail_url: stream.thumbnail_url,
        }
      : null,
  };
}

interface HelixVideosResponse {
  data: Array<{
    id: string;
    title: string;
    url: string;
    thumbnail_url: string;
    duration: string;
    published_at: string;
    view_count: number;
  }>;
}

export async function getTwitchLatestVod(channel: string): Promise<TwitchVodData | null> {
  const login = channel.trim().toLowerCase();
  if (!login) return null;

  const usersRes = await helix<HelixUsersResponse>("/users", { login }, 60 * 60);
  const user = usersRes?.data?.[0];
  if (!user) return null;

  const videosRes = await helix<HelixVideosResponse>(
    "/videos",
    { user_id: user.id, type: "archive", first: "1" },
    60 * 5
  );
  const vod = videosRes?.data?.[0] ?? null;

  return {
    user: { display_name: user.display_name, profile_image_url: user.profile_image_url },
    video: vod
      ? {
          id: vod.id,
          title: vod.title,
          url: vod.url,
          thumbnail_url: vod.thumbnail_url.replace("%{width}", "640").replace("%{height}", "360"),
          duration: vod.duration,
          published_at: vod.published_at,
          view_count: vod.view_count,
        }
      : null,
  };
}

export function parseTwitchChannel(url: string): string | null {
  const match = url.match(/(?:twitch\.tv\/)([a-zA-Z0-9_]{3,25})/i);
  return match ? match[1].toLowerCase() : null;
}
