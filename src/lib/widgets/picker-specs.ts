import type { WidgetKind } from "./types";

/**
 * Client-safe metadata for the canvas widget picker. Lives in its own
 * module (not `resolve.ts`) because `resolve.ts` transitively imports
 * server-only API fetchers — pulling it into a client bundle blows up at
 * build time. The picker UI only needs labels + placeholders.
 */
export interface WidgetPickerSpec {
  kind: WidgetKind;
  label: string;
  placeholder: string;
}

export const WIDGET_PICKER_SPECS: WidgetPickerSpec[] = [
  { kind: "twitch_live",     label: "Twitch live",       placeholder: "twitch.tv/channel" },
  { kind: "twitch_vod",      label: "Twitch latest VOD", placeholder: "twitch.tv/channel" },
  { kind: "youtube_channel", label: "YouTube channel",   placeholder: "youtube.com/@handle" },
  { kind: "youtube_video",   label: "YouTube video",     placeholder: "youtube.com/watch?v=…" },
  { kind: "youtube_live",    label: "YouTube live",      placeholder: "youtube.com/@handle" },
  { kind: "github_repo",     label: "GitHub repo",       placeholder: "owner/repo" },
  { kind: "github_user",     label: "GitHub user",       placeholder: "@username" },
  { kind: "discord_invite",  label: "Discord invite",    placeholder: "discord.gg/xxxxx" },
  { kind: "spotify_embed",   label: "Spotify",           placeholder: "open.spotify.com/…" },
  { kind: "tiktok_video",    label: "TikTok video",      placeholder: "tiktok.com/@user/video/…" },
  { kind: "tip_jar",         label: "Tip jar",           placeholder: "ko-fi.com/username" },
  { kind: "og_card",         label: "Generic link card", placeholder: "https://…" },
  { kind: "cross_promo",     label: "Cross-promote",     placeholder: "instagram.com/username" },
  { kind: "stream_schedule", label: "Stream schedule",   placeholder: "Add schedule →" },
];
