import "server-only";
import type { SteamProfileData } from "./types";

export function parseSteamInput(input: string): string | null {
  const trimmed = input.trim();
  // Full profile URL with steamid64
  const idUrl = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (idUrl) return idUrl[1];
  // Full profile URL with vanity
  const vanityUrl = trimmed.match(/steamcommunity\.com\/id\/([a-zA-Z0-9_-]+)/i);
  if (vanityUrl) return vanityUrl[1];
  // Raw 17-digit Steam64 ID or a vanity username
  if (/^[\da-zA-Z0-9_-]{1,32}$/.test(trimmed)) return trimmed;
  return null;
}

const PERSONA_STATES = ["Offline", "Online", "Busy", "Away", "Snooze", "Looking to trade", "Looking to play"];

interface SteamSummaryResponse {
  response: {
    players: {
      steamid: string;
      personaname: string;
      profileurl: string;
      avatar: string;
      avatarmedium: string;
      avatarfull: string;
      personastate: number;
      gameextrainfo?: string;
    }[];
  };
}

interface SteamGamesResponse {
  response: {
    games?: {
      appid: number;
      name: string;
      playtime_2weeks?: number;
      playtime_forever: number;
      img_icon_url: string;
    }[];
  };
}

export async function getSteamProfile(username: string): Promise<SteamProfileData | null> {
  const key = process.env.STEAM_API_KEY;
  if (!key) return null;

  const input = parseSteamInput(username);
  if (!input) return null;

  // Determine if the input is a Steam64 ID (17 digits) or a vanity URL.
  let steamId: string;
  if (/^\d{17}$/.test(input)) {
    steamId = input;
  } else {
    const resolveRes = await fetch(
      `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${key}&vanityurl=${encodeURIComponent(input)}`,
      { next: { revalidate: 3600 } }
    );
    if (!resolveRes.ok) return null;
    const resolveJson = (await resolveRes.json()) as { response: { success: number; steamid?: string } };
    if (resolveJson.response.success !== 1 || !resolveJson.response.steamid) return null;
    steamId = resolveJson.response.steamid;
  }

  const [summaryRes, gamesRes] = await Promise.all([
    fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${key}&steamids=${steamId}`,
      { next: { revalidate: 300 } }
    ),
    fetch(
      `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${key}&steamid=${steamId}&count=3`,
      { next: { revalidate: 300 } }
    ),
  ]);

  if (!summaryRes.ok) return null;
  const summaryJson = (await summaryRes.json()) as SteamSummaryResponse;
  const player = summaryJson.response?.players?.[0];
  if (!player) return null;

  let recentGames: SteamProfileData["recent_games"] = [];
  if (gamesRes.ok) {
    const gamesJson = (await gamesRes.json()) as SteamGamesResponse;
    recentGames = (gamesJson.response?.games ?? []).slice(0, 3).map((g) => ({
      appid: g.appid,
      name: g.name,
      playtime_2weeks: g.playtime_2weeks ?? 0,
      icon_url: g.img_icon_url
        ? `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`
        : null,
    }));
  }

  return {
    steam_id: steamId,
    username: player.personaname,
    avatar_url: player.avatarfull || player.avatarmedium || player.avatar,
    profile_url: player.profileurl,
    persona_state: PERSONA_STATES[player.personastate ?? 0] ?? "Offline",
    is_online: (player.personastate ?? 0) > 0,
    currently_playing: player.gameextrainfo ?? null,
    recent_games: recentGames,
  };
}
