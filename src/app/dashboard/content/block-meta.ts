import {
  Link2,
  Type,
  Heading as HeadingIcon,
  Minus,
  Radio,
  Sparkles,
  Youtube,
  Github,
  MessageCircle,
  Coffee,
  Music,
  Music2,
  Video,
  Link as LinkIcon,
  PlaySquare,
  Gamepad2,
  Film,
} from "lucide-react";
import type { Block, BlockType } from "@/lib/blocks";
import type { WidgetKind, WidgetSize } from "@/lib/widgets/types";
import { isWidgetSize } from "@/lib/widgets/types";

export const TYPE_ICONS: Record<BlockType, React.ComponentType<{ className?: string }>> = {
  link: Link2,
  text: Type,
  heading: HeadingIcon,
  divider: Minus,
  widget: Sparkles,
};

export type WidgetPickerKind =
  | "auto"
  | "twitch_live"
  | "youtube_channel"
  | "youtube_video"
  | "github_repo"
  | "github_user"
  | "discord_invite"
  | "tip_jar"
  | "spotify_embed"
  | "tiktok_video"
  | "twitch_vod"
  | "youtube_live"
  | "og_card"
  | "cross_promo"
  | "stream_schedule"
  | "lastfm_scrobbles"
  | "steam_profile"
  | "letterboxd_films";

export function widgetKindLabel(kind: Block["widget_kind"]): string {
  switch (kind) {
    case "twitch_live": return "Twitch live";
    case "youtube_channel": return "YouTube channel";
    case "youtube_video": return "YouTube video";
    case "github_repo": return "GitHub repo";
    case "github_user": return "GitHub user";
    case "discord_invite": return "Discord invite";
    case "tip_jar": return "Tip jar";
    case "spotify_embed": return "Spotify";
    case "tiktok_video": return "TikTok";
    case "twitch_vod": return "Twitch VOD";
    case "youtube_live": return "YouTube live";
    case "og_card": return "Link card";
    case "cross_promo": return "Cross-promote";
    case "stream_schedule": return "Stream schedule";
    case "lastfm_scrobbles": return "Last.fm";
    case "steam_profile": return "Steam";
    case "letterboxd_films": return "Letterboxd";
    default: return "Widget";
  }
}

export function widgetSubtitle(block: Block): string {
  const meta = (block.meta ?? {}) as {
    channel?: string;
    handle?: string;
    channel_id?: string;
    video_id?: string;
    owner?: string;
    repo?: string;
    username?: string;
    invite_code?: string;
    platform?: string;
    type?: string;
    id?: string;
    url?: string;
  };
  if (meta.url) return meta.url;
  if (meta.type && meta.id) return `${meta.type}/${meta.id.slice(0, 8)}…`;
  if (meta.owner && meta.repo) return `${meta.owner}/${meta.repo}`;
  if (meta.username) return `@${meta.username}`;
  if (meta.invite_code) return `discord.gg/${meta.invite_code}`;
  if (meta.platform && meta.handle) return `${meta.platform}/${meta.handle}`;
  if (meta.channel) return meta.channel;
  if (meta.handle) return `@${meta.handle}`;
  if (meta.channel_id) return meta.channel_id;
  if (meta.video_id) return `video ${meta.video_id}`;
  return block.title ?? "";
}

export function widgetSizeFromBlock(block: Block): WidgetSize {
  const s = (block.meta as { size?: unknown } | null)?.size;
  return isWidgetSize(s) ? s : "default";
}

export const WIDGET_LABELS: Record<WidgetPickerKind, string> = {
  auto: "Paste any URL",
  twitch_live: "Twitch live status",
  youtube_channel: "YouTube channel",
  youtube_video: "YouTube latest video",
  github_repo: "GitHub repo",
  github_user: "GitHub user",
  discord_invite: "Discord invite",
  tip_jar: "Tip jar",
  spotify_embed: "Spotify embed",
  tiktok_video: "TikTok video",
  twitch_vod: "Twitch latest VOD",
  youtube_live: "YouTube live status",
  og_card: "Generic link card",
  cross_promo: "Cross-promote",
  stream_schedule: "Stream schedule",
  lastfm_scrobbles: "Last.fm scrobbles",
  steam_profile: "Steam profile",
  letterboxd_films: "Letterboxd films",
};

export const WIDGET_PLACEHOLDERS: Record<WidgetPickerKind, string> = {
  auto: "Paste any supported URL",
  twitch_live: "shroud or https://twitch.tv/shroud",
  youtube_channel: "@mkbhd or https://youtube.com/@mkbhd",
  youtube_video: "https://youtube.com/watch?v=…  (or a channel URL for latest)",
  github_repo: "vercel/next.js or https://github.com/vercel/next.js",
  github_user: "@torvalds or https://github.com/torvalds",
  discord_invite: "https://discord.gg/xxxx or just the code",
  tip_jar: "https://ko-fi.com/yourname (or BMaC, Patreon, Streamlabs)",
  spotify_embed: "https://open.spotify.com/track/… (or album, artist, playlist)",
  tiktok_video: "https://tiktok.com/@user/video/…",
  twitch_vod: "shroud or https://twitch.tv/shroud",
  youtube_live: "@mkbhd or https://youtube.com/@mkbhd",
  og_card: "Any https:// URL",
  cross_promo: "https://instagram.com/username  (or TikTok, YouTube, Twitter, Twitch, Spotify)",
  stream_schedule: "",
  lastfm_scrobbles: "yourname or https://last.fm/user/yourname",
  steam_profile: "yourname or https://steamcommunity.com/id/yourname",
  letterboxd_films: "yourname or https://letterboxd.com/yourname",
};

export const WIDGET_HINTS: Record<WidgetPickerKind, string> = {
  auto: "We'll figure out which widget to add. Supports Twitch, YouTube, GitHub, Discord, Ko-fi, BMaC, Patreon, Streamlabs.",
  twitch_live: "Shows a live indicator + viewer count when the channel is streaming.",
  youtube_channel: "Shows subscriber count and links to the channel.",
  youtube_video: "Embeds the most recent upload — or pin a specific video by pasting its URL.",
  github_repo: "Shows stars, forks, language. Updated every 10 min.",
  github_user: "Shows followers + public repo count.",
  discord_invite: "Shows server name, member count, and online count. Auto-refreshes.",
  tip_jar: "Branded button to your tip platform. Detects Ko-fi, BMaC, Patreon, Streamlabs.",
  spotify_embed: "Real Spotify player. Supports track, album, artist, playlist, episode, show.",
  tiktok_video: "Branded card linking to the TikTok video.",
  twitch_vod: "Latest archived broadcast — thumbnail, title, view count. 5-min refresh.",
  youtube_live: "Shows a pulsing LIVE badge when the channel is broadcasting. 1-min refresh.",
  og_card: "Fetches the page's OG metadata (title, description, image) for any URL.",
  cross_promo: "Paste your profile URL from Instagram, TikTok, YouTube, Twitter/X, Twitch, or Spotify. Creates a branded follow button.",
  stream_schedule: "Creates an empty schedule widget. Edit it after adding to fill in your days and times.",
  lastfm_scrobbles: "Shows your most recently scrobbled track and 'Now Playing' status. Updates every minute.",
  steam_profile: "Shows your Steam avatar, online status, and recently played games. Updates every 5 min.",
  letterboxd_films: "Shows your most recently logged film with poster, title, and star rating. Updates every 30 min.",
};

export const WIDGET_ICONS: Record<WidgetKind, React.ComponentType<{ className?: string }>> = {
  twitch_live:     Radio,
  twitch_vod:      PlaySquare,
  youtube_channel: Youtube,
  youtube_video:   Youtube,
  youtube_live:    Radio,
  github_repo:     Github,
  github_user:     Github,
  discord_invite:  MessageCircle,
  spotify_embed:   Music,
  tiktok_video:    Video,
  tip_jar:         Coffee,
  og_card:         LinkIcon,
  cross_promo:       Sparkles,
  stream_schedule:   Radio,
  lastfm_scrobbles:  Music2,
  steam_profile:     Gamepad2,
  letterboxd_films:  Film,
};
