import type { Theme } from "@/lib/themes";
import type {
  WidgetData,
  WidgetKind,
  WidgetSize,
  TipPlatform,
  StreamScheduleMeta,
  CrossPromoMeta,
} from "@/lib/widgets/types";
import { isWidgetSize } from "@/lib/widgets/types";
import type { SpotifyEntityType } from "@/lib/widgets/spotify";
import { TwitchLiveWidget } from "./widgets/twitch-live-widget";
import { TwitchVodWidget } from "./widgets/twitch-vod-widget";
import { YouTubeChannelWidget } from "./widgets/youtube-channel-widget";
import { YouTubeVideoWidget } from "./widgets/youtube-video-widget";
import { YouTubeLiveWidget } from "./widgets/youtube-live-widget";
import { OgCardWidget } from "./widgets/og-card-widget";
import { GitHubRepoWidget } from "./widgets/github-repo-widget";
import { GitHubUserWidget } from "./widgets/github-user-widget";
import { DiscordInviteWidget } from "./widgets/discord-invite-widget";
import { TipJarWidget } from "./widgets/tip-jar-widget";
import { SpotifyEmbedWidget } from "./widgets/spotify-embed-widget";
import { TikTokVideoWidget } from "./widgets/tiktok-video-widget";
import { StreamScheduleWidget } from "./widgets/stream-schedule-widget";
import { CrossPromoWidget } from "./widgets/cross-promo-widget";
import { LastFmScrobblesWidget } from "./widgets/lastfm-scrobbles-widget";
import { SteamProfileWidget } from "./widgets/steam-profile-widget";
import { LetterboxdFilmsWidget } from "./widgets/letterboxd-films-widget";

export interface WidgetRendererProps {
  id: string;
  kind: WidgetKind | null | undefined;
  meta: Record<string, unknown> | null | undefined;
  title: string | null | undefined;
  theme: Theme;
  preview: boolean;
  widgetData: Record<string, WidgetData | undefined>;
  /** Profile username — used to build the iCal URL for stream_schedule widgets. */
  username?: string;
}

function youtubeFallback(meta: Record<string, unknown>): string {
  const handle = meta.handle as string | undefined;
  const channel_id = meta.channel_id as string | undefined;
  if (handle) return `https://youtube.com/@${handle}`;
  if (channel_id) return `https://youtube.com/channel/${channel_id}`;
  return "https://youtube.com";
}

/**
 * Single source of truth for rendering any of the 15 widget kinds.
 * Used by both the stack-mode (ProfileRender) and canvas-mode
 * (ProfileCanvasRender) renderers — adding a widget kind only requires
 * updating this file.
 */
export function WidgetRenderer({
  id,
  kind,
  meta: rawMeta,
  title,
  theme,
  preview,
  widgetData,
  username,
}: WidgetRendererProps) {
  const meta = rawMeta ?? {};
  const wd = widgetData[id];
  const size: WidgetSize = isWidgetSize((rawMeta as { size?: unknown } | null)?.size)
    ? (rawMeta as { size: WidgetSize }).size
    : "default";

  if (kind === "twitch_live") {
    const channel = (meta.channel as string | undefined) ?? title ?? "";
    const data = wd?.kind === "twitch_live" ? wd.data : null;
    return <TwitchLiveWidget channel={channel} data={data} theme={theme} size={size} preview={preview} />;
  }
  if (kind === "twitch_vod") {
    const channel = (meta.channel as string | undefined) ?? title ?? "";
    const data = wd?.kind === "twitch_vod" ? wd.data : null;
    return <TwitchVodWidget channel={channel} data={data} theme={theme} size={size} preview={preview} />;
  }
  if (kind === "youtube_live") {
    const data = wd?.kind === "youtube_live" ? wd.data : null;
    return (
      <YouTubeLiveWidget data={data} fallbackUrl={youtubeFallback(meta)} theme={theme} size={size} preview={preview} />
    );
  }
  if (kind === "youtube_channel") {
    const data = wd?.kind === "youtube_channel" ? wd.data : null;
    return (
      <YouTubeChannelWidget data={data} fallbackUrl={youtubeFallback(meta)} theme={theme} size={size} preview={preview} />
    );
  }
  if (kind === "youtube_video") {
    const data = wd?.kind === "youtube_video" ? wd.data : null;
    const fallbackUrl = (meta.video_id as string | undefined)
      ? `https://youtube.com/watch?v=${meta.video_id as string}`
      : youtubeFallback(meta);
    return (
      <YouTubeVideoWidget data={data} fallbackUrl={fallbackUrl} theme={theme} size={size} preview={preview} />
    );
  }
  if (kind === "og_card") {
    const data = wd?.kind === "og_card" ? wd.data : null;
    return (
      <OgCardWidget data={data} fallbackUrl={(meta.url as string | undefined) ?? "#"} theme={theme} size={size} preview={preview} />
    );
  }
  if (kind === "github_repo") {
    const owner = meta.owner as string | undefined;
    const repo = meta.repo as string | undefined;
    const data = wd?.kind === "github_repo" ? wd.data : null;
    return (
      <GitHubRepoWidget
        data={data}
        fallbackUrl={owner && repo ? `https://github.com/${owner}/${repo}` : "https://github.com"}
        theme={theme} size={size} preview={preview}
      />
    );
  }
  if (kind === "github_user") {
    const ghUsername = meta.username as string | undefined;
    const data = wd?.kind === "github_user" ? wd.data : null;
    return (
      <GitHubUserWidget
        data={data}
        fallbackUrl={ghUsername ? `https://github.com/${ghUsername}` : "https://github.com"}
        theme={theme} size={size} preview={preview}
      />
    );
  }
  if (kind === "discord_invite") {
    const data = wd?.kind === "discord_invite" ? wd.data : null;
    return (
      <DiscordInviteWidget
        inviteCode={(meta.invite_code as string | undefined) ?? ""}
        data={data} theme={theme} size={size} preview={preview}
      />
    );
  }
  if (kind === "tip_jar") {
    const platform = meta.platform as TipPlatform | undefined;
    const handle = meta.handle as string | undefined;
    if (!platform || !handle) return null;
    return <TipJarWidget platform={platform} handle={handle} theme={theme} size={size} preview={preview} />;
  }
  if (kind === "spotify_embed") {
    const type = meta.type as SpotifyEntityType | undefined;
    const id = meta.id as string | undefined;
    if (!type || !id) return null;
    return <SpotifyEmbedWidget type={type} id={id} theme={theme} size={size} preview={preview} />;
  }
  if (kind === "tiktok_video") {
    const tiktokUsername = meta.username as string | undefined;
    const video_id = meta.video_id as string | undefined;
    if (!tiktokUsername || !video_id) return null;
    return <TikTokVideoWidget username={tiktokUsername} videoId={video_id} theme={theme} size={size} preview={preview} />;
  }
  if (kind === "stream_schedule") {
    const data =
      (wd?.kind === "stream_schedule" ? wd.data : null) ??
      (meta as unknown as StreamScheduleMeta | null);
    return (
      <StreamScheduleWidget
        data={data} theme={theme} size={size}
        icalUrl={preview ? undefined : (username ? `/api/ical/${username}` : undefined)}
      />
    );
  }
  if (kind === "cross_promo") {
    const data =
      (wd?.kind === "cross_promo" ? wd.data : null) ??
      (meta as unknown as CrossPromoMeta | null);
    return <CrossPromoWidget data={data} size={size} preview={preview} />;
  }
  if (kind === "lastfm_scrobbles") {
    const lfmUsername = (meta.username as string | undefined) ?? title ?? "";
    const data = wd?.kind === "lastfm_scrobbles" ? wd.data : null;
    return <LastFmScrobblesWidget username={lfmUsername} data={data} theme={theme} size={size} preview={preview} />;
  }
  if (kind === "steam_profile") {
    const steamUsername = (meta.username as string | undefined) ?? title ?? "";
    const data = wd?.kind === "steam_profile" ? wd.data : null;
    return <SteamProfileWidget username={steamUsername} data={data} theme={theme} size={size} preview={preview} />;
  }
  if (kind === "letterboxd_films") {
    const lbxUsername = (meta.username as string | undefined) ?? title ?? "";
    const data = wd?.kind === "letterboxd_films" ? wd.data : null;
    return <LetterboxdFilmsWidget username={lbxUsername} data={data} theme={theme} size={size} preview={preview} />;
  }
  return null;
}
