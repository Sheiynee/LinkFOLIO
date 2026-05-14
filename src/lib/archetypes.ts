import type { WidgetKind } from "./widgets/types";

export type ArchetypeId =
  | "streamer"
  | "youtuber"
  | "musician"
  | "podcaster"
  | "visual_artist"
  | "game_dev"
  | "other";

export interface PlatformInput {
  id: string;
  label: string;
  placeholder: string;
  widgetKind: WidgetKind;
}

export interface Archetype {
  id: ArchetypeId;
  label: string;
  emoji: string;
  description: string;
  platforms: PlatformInput[];
  defaultPreset: string; // matches a theme preset id
}

const TWITCH: PlatformInput = {
  id: "twitch",
  label: "Twitch",
  placeholder: "twitch.tv/yourchannel",
  widgetKind: "twitch_live",
};
const YOUTUBE: PlatformInput = {
  id: "youtube",
  label: "YouTube",
  placeholder: "youtube.com/@yourhandle",
  widgetKind: "youtube_channel",
};
const SPOTIFY: PlatformInput = {
  id: "spotify",
  label: "Spotify",
  placeholder: "open.spotify.com/artist/… or playlist/…",
  widgetKind: "spotify_embed",
};
const TIKTOK: PlatformInput = {
  id: "tiktok",
  label: "TikTok",
  placeholder: "tiktok.com/@you/video/…",
  widgetKind: "tiktok_video",
};
const GITHUB_USER: PlatformInput = {
  id: "github",
  label: "GitHub",
  placeholder: "github.com/yourname",
  widgetKind: "github_user",
};
const DISCORD: PlatformInput = {
  id: "discord",
  label: "Discord",
  placeholder: "discord.gg/xxxx",
  widgetKind: "discord_invite",
};
const PATREON: PlatformInput = {
  id: "patreon",
  label: "Patreon",
  placeholder: "patreon.com/yourname",
  widgetKind: "tip_jar",
};
const KOFI: PlatformInput = {
  id: "kofi",
  label: "Ko-fi / BMaC",
  placeholder: "ko-fi.com/yourname",
  widgetKind: "tip_jar",
};

export const ARCHETYPES: Archetype[] = [
  {
    id: "streamer",
    label: "Streamer",
    emoji: "🎮",
    description: "Twitch, Discord, tip jar — energetic and dark.",
    platforms: [TWITCH, YOUTUBE, DISCORD, KOFI, PATREON],
    defaultPreset: "neon",
  },
  {
    id: "youtuber",
    label: "YouTuber",
    emoji: "📺",
    description: "Channel + latest video front and center.",
    platforms: [YOUTUBE, TIKTOK, DISCORD, PATREON],
    defaultPreset: "vercel",
  },
  {
    id: "musician",
    label: "Musician",
    emoji: "🎵",
    description: "Spotify embed, YouTube music videos, tip jars.",
    platforms: [SPOTIFY, YOUTUBE, TIKTOK, PATREON],
    defaultPreset: "sunset",
  },
  {
    id: "podcaster",
    label: "Podcaster",
    emoji: "🎙️",
    description: "Latest episode embed and supporter platforms.",
    platforms: [SPOTIFY, YOUTUBE, PATREON, KOFI],
    defaultPreset: "notion",
  },
  {
    id: "visual_artist",
    label: "Visual Artist",
    emoji: "🎨",
    description: "Galleries, prints, commission links.",
    platforms: [TIKTOK, YOUTUBE, KOFI, PATREON],
    defaultPreset: "glass",
  },
  {
    id: "game_dev",
    label: "Game Dev",
    emoji: "🕹️",
    description: "GitHub, devlog, Discord community.",
    platforms: [GITHUB_USER, YOUTUBE, DISCORD, TWITCH],
    defaultPreset: "vercel",
  },
  {
    id: "other",
    label: "Other",
    emoji: "✨",
    description: "Pick the platforms you want yourself.",
    platforms: [YOUTUBE, GITHUB_USER, SPOTIFY, DISCORD, KOFI],
    defaultPreset: "glass",
  },
];

export function getArchetype(id: string | null | undefined): Archetype {
  return ARCHETYPES.find((a) => a.id === id) ?? ARCHETYPES[ARCHETYPES.length - 1];
}
