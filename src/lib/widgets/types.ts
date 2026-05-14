export type WidgetKind =
  | "twitch_live"
  | "twitch_vod"
  | "youtube_video"
  | "youtube_channel"
  | "youtube_live"
  | "spotify_embed"
  | "tiktok_video"
  | "github_repo"
  | "github_user"
  | "discord_invite"
  | "tip_jar"
  | "og_card";

export interface TwitchLiveMeta {
  channel: string;
}

export interface TwitchVodData {
  user: { display_name: string; profile_image_url: string };
  video: {
    id: string;
    title: string;
    url: string;
    thumbnail_url: string;
    duration: string;
    published_at: string;
    view_count: number;
  } | null;
  fetched_at: string;
}

export interface YouTubeLiveData {
  channel: { id: string; title: string; thumbnail_url: string; custom_url: string | null };
  live: { video_id: string; title: string; thumbnail_url: string } | null;
  fetched_at: string;
}

export interface OgCardData {
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
  url: string;
}

export interface TwitchLiveData {
  user: {
    id: string;
    login: string;
    display_name: string;
    profile_image_url: string;
  };
  stream: {
    title: string;
    game_name: string;
    viewer_count: number;
    started_at: string;
    thumbnail_url: string;
  } | null;
  fetched_at: string;
}

export interface YouTubeChannelMeta {
  channel_id?: string;
  handle?: string;
}

export interface YouTubeChannelData {
  channel: {
    id: string;
    title: string;
    description: string;
    custom_url: string | null;
    thumbnail_url: string;
    subscriber_count: number;
    video_count: number;
    view_count: number;
  };
}

export interface YouTubeVideoMeta {
  video_id?: string;
  channel_id?: string;
  handle?: string;
}

export interface YouTubeVideoData {
  video: {
    id: string;
    title: string;
    channel_title: string;
    published_at: string;
    thumbnail_url: string;
    view_count: number | null;
  };
}

export interface GitHubRepoData {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  owner: { login: string; avatar_url: string };
  html_url: string;
}

export interface GitHubUserData {
  login: string;
  name: string | null;
  bio: string | null;
  avatar_url: string;
  followers: number;
  public_repos: number;
  html_url: string;
}

export interface DiscordInviteData {
  guild: { name: string; icon_url: string | null };
  approximate_member_count: number | null;
  approximate_presence_count: number | null;
  invite_code: string;
}

export type TipPlatform = "kofi" | "bmac" | "patreon" | "streamlabs";

export interface TipJarMeta {
  platform: TipPlatform;
  handle: string;
}

export type WidgetData =
  | { kind: "twitch_live"; data: TwitchLiveData | null }
  | { kind: "twitch_vod"; data: TwitchVodData | null }
  | { kind: "youtube_channel"; data: YouTubeChannelData | null }
  | { kind: "youtube_video"; data: YouTubeVideoData | null }
  | { kind: "youtube_live"; data: YouTubeLiveData | null }
  | { kind: "og_card"; data: OgCardData | null }
  | { kind: "github_repo"; data: GitHubRepoData | null }
  | { kind: "github_user"; data: GitHubUserData | null }
  | { kind: "discord_invite"; data: DiscordInviteData | null }
  | { kind: "tip_jar"; data: null }
  | { kind: "spotify_embed"; data: null }
  | { kind: "tiktok_video"; data: null }
  | { kind: "unsupported"; data: null };
