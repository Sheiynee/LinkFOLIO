import { ExternalLink } from "lucide-react";
import { fontVarFor } from "@/lib/fonts";
import {
  type Theme,
  buttonRadiusClass,
  buttonExtraStyle,
} from "@/lib/themes";
import type { Block } from "@/lib/blocks";
import type { WidgetData } from "@/lib/widgets/types";
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
import type { TipPlatform } from "@/lib/widgets/types";
import type { SpotifyEntityType } from "@/lib/widgets/spotify";

export interface ProfileRenderData {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  blocks: Block[];
}

export function ProfileRender({
  profile,
  theme,
  preview = false,
  widgetData = {},
}: {
  profile: ProfileRenderData;
  theme: Theme;
  preview?: boolean;
  widgetData?: Record<string, WidgetData | undefined>;
}) {
  const name = profile.display_name ?? profile.username;
  const fontVar = fontVarFor(theme.font);
  const radiusClass = buttonRadiusClass(theme.button_shape);
  const extraButtonStyle = buttonExtraStyle(theme.button_style);

  const containerStyle: React.CSSProperties = {
    background: theme.bg_image_url
      ? `linear-gradient(to bottom right, ${theme.bg_from}cc, ${theme.bg_to}cc), url(${theme.bg_image_url})`
      : `linear-gradient(to bottom right, ${theme.bg_from}, ${theme.bg_to})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    color: theme.text_color,
    fontFamily: fontVar,
  };

  const buttonStyle: React.CSSProperties = {
    backgroundColor: theme.button_bg,
    color: theme.button_text,
    borderColor: theme.button_border,
    ...extraButtonStyle,
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center py-16 px-4"
      style={containerStyle}
    >
      <div
        className="h-24 w-24 mb-4 rounded-full overflow-hidden ring-4"
        style={{ borderColor: theme.accent_color, boxShadow: `0 0 0 4px ${theme.accent_color}40` }}
      >
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full flex items-center justify-center text-3xl font-bold"
            style={{ backgroundColor: theme.accent_color, color: theme.button_text }}
          >
            {name[0]?.toUpperCase()}
          </div>
        )}
      </div>

      <h1 className="text-2xl font-bold mb-1">{name}</h1>
      <p className="mb-4 text-sm font-mono" style={{ color: theme.muted_color }}>
        @{profile.username}
      </p>

      {profile.bio && (
        <p className="text-center max-w-sm mb-8" style={{ color: theme.muted_color }}>
          {profile.bio}
        </p>
      )}

      <div className="w-full max-w-sm space-y-3">
        {profile.blocks.length === 0 ? (
          <p className="text-center text-sm" style={{ color: theme.muted_color }}>
            Nothing here yet.
          </p>
        ) : (
          profile.blocks.map((block) => {
            switch (block.type) {
              case "link":
                if (!block.url || !block.title) return null;
                return (
                  <a
                    key={block.id}
                    href={preview ? "#" : `/r/${block.id}`}
                    target={preview ? undefined : "_blank"}
                    rel={preview ? undefined : "noopener noreferrer"}
                    onClick={preview ? (e) => e.preventDefault() : undefined}
                    className={`flex items-center justify-between w-full border px-5 py-3 transition hover:opacity-90 ${radiusClass}`}
                    style={buttonStyle}
                  >
                    <span className="font-medium">{block.title}</span>
                    <ExternalLink className="h-4 w-4 opacity-60" />
                  </a>
                );
              case "heading":
                return (
                  <h2
                    key={block.id}
                    className="text-xl font-bold pt-4 pb-1 text-center"
                    style={{ color: theme.text_color }}
                  >
                    {block.content}
                  </h2>
                );
              case "text":
                return (
                  <p
                    key={block.id}
                    className="whitespace-pre-wrap text-center text-sm leading-relaxed py-2"
                    style={{ color: theme.muted_color }}
                  >
                    {block.content}
                  </p>
                );
              case "divider":
                return (
                  <hr
                    key={block.id}
                    className="my-2 border-0 h-px w-full"
                    style={{ backgroundColor: theme.muted_color, opacity: 0.3 }}
                  />
                );
              case "widget": {
                const wd = widgetData[block.id];
                if (block.widget_kind === "twitch_live") {
                  const channel = (block.meta as { channel?: string } | null)?.channel ?? block.title ?? "";
                  const data = wd?.kind === "twitch_live" ? wd.data : null;
                  return (
                    <TwitchLiveWidget
                      key={block.id}
                      channel={channel}
                      data={data}
                      theme={theme}
                      preview={preview}
                    />
                  );
                }
                if (block.widget_kind === "twitch_vod") {
                  const channel = (block.meta as { channel?: string } | null)?.channel ?? block.title ?? "";
                  const data = wd?.kind === "twitch_vod" ? wd.data : null;
                  return (
                    <TwitchVodWidget
                      key={block.id}
                      channel={channel}
                      data={data}
                      theme={theme}
                      preview={preview}
                    />
                  );
                }
                if (block.widget_kind === "youtube_live") {
                  const meta = (block.meta ?? {}) as { channel_id?: string; handle?: string };
                  const fallbackUrl = meta.handle
                    ? `https://youtube.com/@${meta.handle}`
                    : meta.channel_id
                      ? `https://youtube.com/channel/${meta.channel_id}`
                      : "https://youtube.com";
                  const data = wd?.kind === "youtube_live" ? wd.data : null;
                  return (
                    <YouTubeLiveWidget
                      key={block.id}
                      data={data}
                      fallbackUrl={fallbackUrl}
                      theme={theme}
                      preview={preview}
                    />
                  );
                }
                if (block.widget_kind === "og_card") {
                  const meta = (block.meta ?? {}) as { url?: string };
                  const fallbackUrl = meta.url ?? "#";
                  const data = wd?.kind === "og_card" ? wd.data : null;
                  return (
                    <OgCardWidget
                      key={block.id}
                      data={data}
                      fallbackUrl={fallbackUrl}
                      theme={theme}
                      preview={preview}
                    />
                  );
                }
                if (block.widget_kind === "youtube_channel") {
                  const meta = (block.meta ?? {}) as { channel_id?: string; handle?: string };
                  const fallbackUrl = meta.handle
                    ? `https://youtube.com/@${meta.handle}`
                    : meta.channel_id
                      ? `https://youtube.com/channel/${meta.channel_id}`
                      : "https://youtube.com";
                  const data = wd?.kind === "youtube_channel" ? wd.data : null;
                  return (
                    <YouTubeChannelWidget
                      key={block.id}
                      data={data}
                      fallbackUrl={fallbackUrl}
                      theme={theme}
                      preview={preview}
                    />
                  );
                }
                if (block.widget_kind === "youtube_video") {
                  const meta = (block.meta ?? {}) as { video_id?: string; channel_id?: string; handle?: string };
                  const fallbackUrl = meta.video_id
                    ? `https://youtube.com/watch?v=${meta.video_id}`
                    : meta.handle
                      ? `https://youtube.com/@${meta.handle}`
                      : "https://youtube.com";
                  const data = wd?.kind === "youtube_video" ? wd.data : null;
                  return (
                    <YouTubeVideoWidget
                      key={block.id}
                      data={data}
                      fallbackUrl={fallbackUrl}
                      theme={theme}
                      preview={preview}
                    />
                  );
                }
                if (block.widget_kind === "github_repo") {
                  const meta = (block.meta ?? {}) as { owner?: string; repo?: string };
                  const fallbackUrl = meta.owner && meta.repo
                    ? `https://github.com/${meta.owner}/${meta.repo}`
                    : "https://github.com";
                  const data = wd?.kind === "github_repo" ? wd.data : null;
                  return (
                    <GitHubRepoWidget
                      key={block.id}
                      data={data}
                      fallbackUrl={fallbackUrl}
                      theme={theme}
                      preview={preview}
                    />
                  );
                }
                if (block.widget_kind === "github_user") {
                  const meta = (block.meta ?? {}) as { username?: string };
                  const fallbackUrl = meta.username
                    ? `https://github.com/${meta.username}`
                    : "https://github.com";
                  const data = wd?.kind === "github_user" ? wd.data : null;
                  return (
                    <GitHubUserWidget
                      key={block.id}
                      data={data}
                      fallbackUrl={fallbackUrl}
                      theme={theme}
                      preview={preview}
                    />
                  );
                }
                if (block.widget_kind === "discord_invite") {
                  const meta = (block.meta ?? {}) as { invite_code?: string };
                  const data = wd?.kind === "discord_invite" ? wd.data : null;
                  return (
                    <DiscordInviteWidget
                      key={block.id}
                      inviteCode={meta.invite_code ?? ""}
                      data={data}
                      theme={theme}
                      preview={preview}
                    />
                  );
                }
                if (block.widget_kind === "tip_jar") {
                  const meta = (block.meta ?? {}) as { platform?: TipPlatform; handle?: string };
                  if (!meta.platform || !meta.handle) return null;
                  return (
                    <TipJarWidget
                      key={block.id}
                      platform={meta.platform}
                      handle={meta.handle}
                      theme={theme}
                      preview={preview}
                    />
                  );
                }
                if (block.widget_kind === "spotify_embed") {
                  const meta = (block.meta ?? {}) as { type?: SpotifyEntityType; id?: string };
                  if (!meta.type || !meta.id) return null;
                  return (
                    <SpotifyEmbedWidget
                      key={block.id}
                      type={meta.type}
                      id={meta.id}
                      theme={theme}
                      preview={preview}
                    />
                  );
                }
                if (block.widget_kind === "tiktok_video") {
                  const meta = (block.meta ?? {}) as { username?: string; video_id?: string };
                  if (!meta.username || !meta.video_id) return null;
                  return (
                    <TikTokVideoWidget
                      key={block.id}
                      username={meta.username}
                      videoId={meta.video_id}
                      theme={theme}
                      preview={preview}
                    />
                  );
                }
                return null;
              }
              default:
                return null;
            }
          })
        )}
      </div>

      <p className="mt-12 text-xs" style={{ color: theme.muted_color }}>
        Powered by{" "}
        <a
          href={preview ? "#" : "/"}
          onClick={preview ? (e) => e.preventDefault() : undefined}
          className="hover:underline font-medium"
          style={{ color: theme.accent_color }}
        >
          LinkFolio
        </a>
      </p>
    </div>
  );
}
