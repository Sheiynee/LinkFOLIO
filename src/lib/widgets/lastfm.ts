import "server-only";
import type { LastFmScrobblesData } from "./types";

export function parseLastFmUsername(input: string): string | null {
  const trimmed = input.trim();
  const m = trimmed.match(/last\.fm\/user\/([a-zA-Z0-9_-]{2,15})/i);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{2,15}$/.test(trimmed)) return trimmed;
  return null;
}

interface LastFmRawTrack {
  name: string;
  artist: { "#text": string };
  album?: { "#text": string };
  image?: { "#text": string; size: string }[];
  url: string;
  "@attr"?: { nowplaying?: string };
  date?: { "#text": string; uts: string };
}

interface LastFmApiResponse {
  error?: number;
  recenttracks?: { track: LastFmRawTrack | LastFmRawTrack[] };
}

export async function getLastFmScrobbles(username: string): Promise<LastFmScrobblesData | null> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return null;

  const url =
    `https://ws.audioscrobbler.com/2.0/?method=user.getRecentTracks` +
    `&user=${encodeURIComponent(username)}&api_key=${key}&format=json&limit=5`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return null;

  const json = (await res.json()) as LastFmApiResponse;
  if (json.error) return null;

  const raw = json.recenttracks?.track;
  const tracks: LastFmRawTrack[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (tracks.length === 0) return null;

  return {
    username,
    user_url: `https://www.last.fm/user/${username}`,
    tracks: tracks.slice(0, 5).map((t) => ({
      name: t.name,
      artist: t.artist["#text"],
      album: t.album?.["#text"] ?? null,
      image_url: t.image?.find((i) => i.size === "large")?.["#text"] || null,
      url: t.url,
      now_playing: t["@attr"]?.nowplaying === "true",
      date: t.date?.["#text"] ?? null,
    })),
  };
}
