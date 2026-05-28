import { detectWidgetFromUrl } from "./detect";
import { parseTwitchChannel } from "./twitch";
import { parseYouTubeUrl } from "./youtube";
import { parseGitHubUrl } from "./github";
import { parseDiscordInvite } from "./discord";
import { parseTipJarUrl, TIP_PLATFORMS } from "./tip-jar";
import { parseSpotifyUrl } from "./spotify";
import { parseTikTokUrl } from "./tiktok";
import { isProbablyValidUrl } from "./og-scraper";
import { parseLastFmUsername } from "./lastfm";
import { parseSteamInput } from "./steam";
import { parseLetterboxdUsername } from "./letterboxd";
import type { WidgetKind } from "./types";

/**
 * Turn a single string input (URL, handle, channel name) into the
 * `(widget_kind, meta, title)` triple the renderer expects. Shared
 * between the stack-mode (`blocks`) and canvas-mode (`elements`) flows
 * — both store the same widget shape, only the wrapping row differs.
 */
export type ResolveResult =
  | { kind: WidgetKind; meta: Record<string, unknown>; title: string | null }
  | { error: string };

export function resolveWidget(kind: WidgetKind | "auto", input: string): ResolveResult {
  const trimmed = input.trim();
  if (!trimmed) return { error: "Enter a URL or handle" };

  if (kind === "auto") {
    const detected = detectWidgetFromUrl(trimmed);
    if (!detected) return { error: "Couldn't recognize that URL — pick a widget type below" };
    return { kind: detected.kind, meta: detected.meta, title: detected.label };
  }

  if (kind === "twitch_live" || kind === "twitch_vod") {
    const channel = parseTwitchChannel(trimmed) ?? trimmed.toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,25}$/.test(channel)) {
      return { error: "Enter a Twitch channel name or twitch.tv URL" };
    }
    return { kind, meta: { channel }, title: channel };
  }

  if (kind === "youtube_channel" || kind === "youtube_live") {
    const yt = parseYouTubeUrl(trimmed);
    if (yt?.kind === "youtube_channel") {
      return {
        kind,
        meta: yt.channel_id ? { channel_id: yt.channel_id } : { handle: yt.handle },
        title: yt.handle ? `@${yt.handle}` : "YouTube channel",
      };
    }
    if (/^@?[a-zA-Z0-9._-]+$/.test(trimmed)) {
      const handle = trimmed.replace(/^@/, "");
      return { kind, meta: { handle }, title: `@${handle}` };
    }
    return { error: "Enter a YouTube channel URL or @handle" };
  }

  if (kind === "youtube_video") {
    const yt = parseYouTubeUrl(trimmed);
    if (yt?.kind === "youtube_video") {
      return { kind, meta: { video_id: yt.video_id }, title: "YouTube video" };
    }
    if (yt?.kind === "youtube_channel") {
      return {
        kind,
        meta: yt.channel_id ? { channel_id: yt.channel_id } : { handle: yt.handle },
        title: "Latest from " + (yt.handle ? `@${yt.handle}` : "YouTube"),
      };
    }
    return { error: "Enter a YouTube video URL or channel" };
  }

  if (kind === "github_repo") {
    const gh = parseGitHubUrl(trimmed);
    if (gh?.kind === "github_repo" && gh.owner && gh.repo) {
      return { kind, meta: { owner: gh.owner, repo: gh.repo }, title: `${gh.owner}/${gh.repo}` };
    }
    const m = trimmed.match(/^([a-zA-Z0-9-]{1,39})\/([a-zA-Z0-9._-]{1,100})$/);
    if (m) return { kind, meta: { owner: m[1], repo: m[2] }, title: trimmed };
    return { error: "Enter owner/repo or a github.com URL" };
  }

  if (kind === "github_user") {
    const gh = parseGitHubUrl(trimmed);
    if (gh?.kind === "github_user" && gh.username) {
      return { kind, meta: { username: gh.username }, title: `@${gh.username}` };
    }
    if (/^@?[a-zA-Z0-9-]{1,39}$/.test(trimmed)) {
      const username = trimmed.replace(/^@/, "");
      return { kind, meta: { username }, title: `@${username}` };
    }
    return { error: "Enter a GitHub username or profile URL" };
  }

  if (kind === "discord_invite") {
    const code = parseDiscordInvite(trimmed);
    if (code) return { kind, meta: { invite_code: code }, title: "Discord server" };
    return { error: "Enter a discord.gg invite link or code" };
  }

  if (kind === "spotify_embed") {
    const sp = parseSpotifyUrl(trimmed);
    if (sp) return { kind, meta: { type: sp.type, id: sp.id }, title: `Spotify ${sp.type}` };
    return { error: "Paste a Spotify track, album, artist, or playlist URL" };
  }

  if (kind === "tiktok_video") {
    const tt = parseTikTokUrl(trimmed);
    if (tt) {
      return {
        kind,
        meta: { username: tt.username, video_id: tt.video_id },
        title: `TikTok @${tt.username}`,
      };
    }
    return { error: "Paste a TikTok video URL (tiktok.com/@user/video/…)" };
  }

  if (kind === "og_card") {
    if (!isProbablyValidUrl(trimmed)) {
      return { error: "Paste a valid http(s) URL" };
    }
    return { kind, meta: { url: trimmed }, title: trimmed };
  }

  if (kind === "tip_jar") {
    const tip = parseTipJarUrl(trimmed);
    if (tip) {
      return {
        kind,
        meta: { platform: tip.platform, handle: tip.handle },
        title: `Tip on ${TIP_PLATFORMS[tip.platform].label}`,
      };
    }
    return { error: "Paste a Ko-fi, Buy Me a Coffee, Patreon, or Streamlabs URL" };
  }

  if (kind === "cross_promo") {
    const detected = detectCrossPromoFromUrl(trimmed);
    if (detected) return { kind, meta: detected.meta as unknown as Record<string, unknown>, title: detected.title };
    return { error: "Paste a social profile URL (Twitch, YouTube, TikTok, Instagram, Twitter/X, or Spotify)" };
  }

  if (kind === "stream_schedule") {
    // stream_schedule is configured via a dedicated form, not a URL.
    // This branch handles the case where the picker submits an empty/placeholder string.
    return {
      kind,
      meta: { timezone: "UTC", events: [] },
      title: "Stream schedule",
    };
  }

  if (kind === "lastfm_scrobbles") {
    const username = parseLastFmUsername(trimmed) ?? trimmed;
    if (!/^[a-zA-Z0-9_-]{2,15}$/.test(username)) {
      return { error: "Enter a Last.fm username or last.fm/user/… URL" };
    }
    return { kind, meta: { username }, title: `${username} on Last.fm` };
  }

  if (kind === "steam_profile") {
    const value = parseSteamInput(trimmed);
    if (!value) return { error: "Enter a Steam vanity URL, steamcommunity.com URL, or Steam64 ID" };
    return { kind, meta: { username: value }, title: `Steam — ${value}` };
  }

  if (kind === "letterboxd_films") {
    const username = parseLetterboxdUsername(trimmed);
    if (!username) return { error: "Enter a Letterboxd username or letterboxd.com/… URL" };
    return { kind, meta: { username }, title: `${username} on Letterboxd` };
  }

  return { error: "Widget kind not implemented yet" };
}

import { detectCrossPromoFromUrl } from "./cross-promo";

// Picker metadata moved to `./picker-specs.ts` so the canvas client can
// import it without pulling in the server-only API fetchers this module
// transitively depends on. Re-export from there for compatibility.
export { WIDGET_PICKER_SPECS, type WidgetPickerSpec } from "./picker-specs";
