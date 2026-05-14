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
}

export type WidgetData =
  | { kind: "twitch_live"; data: TwitchLiveData | null }
  | { kind: "youtube_channel"; data: unknown }
  | { kind: "unsupported"; data: null };
