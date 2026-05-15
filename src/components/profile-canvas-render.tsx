import { ExternalLink } from "lucide-react";
import {
  type Theme,
  buttonRadiusClass,
  buttonExtraStyle,
} from "@/lib/themes";
import {
  type Element,
  sortElementsForPaint,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from "@/lib/elements";
import type { WidgetData, WidgetSize } from "@/lib/widgets/types";
import { isWidgetSize } from "@/lib/widgets/types";
import {
  styleForRole,
  readBlockTypographyOverride,
  resolveElementTypography,
  userFontFaceCss,
  type UserFontRecord,
} from "@/lib/typography";
import { BackgroundLayers } from "./background-layers";
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
import type { ProfileRenderData } from "./profile-render";

export interface ProfileCanvasRenderProps {
  profile: ProfileRenderData;
  elements: Element[];
  theme: Theme;
  preview?: boolean;
  widgetData?: Record<string, WidgetData | undefined>;
  userFonts?: UserFontRecord[];
  /** Overlay rendered above elements (e.g. selection handles in the editor). */
  overlay?: React.ReactNode;
  /** Called when the canvas surface (not an element) is clicked. */
  onSurfaceClick?: () => void;
}

export function ProfileCanvasRender({
  profile,
  elements,
  theme,
  preview = false,
  widgetData = {},
  userFonts = [],
  overlay,
  onSurfaceClick,
}: ProfileCanvasRenderProps) {
  const name = profile.display_name ?? profile.username;

  const bodyStyle = styleForRole(theme.typography.body, userFonts);
  const displayStyle = styleForRole(theme.typography.display, userFonts);
  const monoStyle = styleForRole(theme.typography.mono, userFonts);

  const fontFaceCss = userFontFaceCss(userFonts);

  // Canvas grows past CANVAS_HEIGHT if elements extend below it.
  const tallestY = elements.reduce((acc, e) => Math.max(acc, e.y + e.h), 0);
  const canvasHeight = Math.max(CANVAS_HEIGHT, tallestY + 80);

  return (
    <div
      className="relative min-h-screen w-full flex flex-col items-center py-12 px-4 isolate"
      style={{ color: theme.text_color, ...bodyStyle }}
    >
      {fontFaceCss && <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} />}
      <BackgroundLayers layers={theme.background.layers} />

      <div
        className="relative"
        style={{ width: CANVAS_WIDTH, height: canvasHeight }}
        onClick={(e) => {
          if (e.currentTarget === e.target) onSurfaceClick?.();
        }}
      >
        {/* Header — avatar, name, bio. Sits at the top of the canvas. */}
        <div
          className="absolute flex flex-col items-center text-center pointer-events-none"
          style={{ left: 0, right: 0, top: 24 }}
        >
          <div
            className="h-24 w-24 mb-3 rounded-full overflow-hidden ring-4"
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
          <h1 className="text-2xl font-bold" style={displayStyle}>{name}</h1>
          <p className="mt-0.5 text-sm" style={{ ...monoStyle, color: theme.muted_color }}>
            @{profile.username}
          </p>
          {profile.bio && (
            <p className="mt-2 max-w-sm text-sm" style={{ color: theme.muted_color }}>
              {profile.bio}
            </p>
          )}
        </div>

        {/* Positioned elements */}
        {sortElementsForPaint(elements).map((el) => (
          <ElementBox
            key={el.id}
            element={el}
            theme={theme}
            preview={preview}
            widgetData={widgetData}
            userFonts={userFonts}
          />
        ))}

        {overlay}
      </div>

      <p className="mt-8 text-xs" style={{ color: theme.muted_color }}>
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

function ElementBox({
  element,
  theme,
  preview,
  widgetData,
  userFonts,
}: {
  element: Element;
  theme: Theme;
  preview: boolean;
  widgetData: Record<string, WidgetData | undefined>;
  userFonts: UserFontRecord[];
}) {
  const wrapperStyle: React.CSSProperties = {
    left: element.x,
    top: element.y,
    width: element.w,
    height: element.h,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.z,
  };

  return (
    <div
      data-element-id={element.id}
      className="absolute"
      style={wrapperStyle}
    >
      <ElementContent
        element={element}
        theme={theme}
        preview={preview}
        widgetData={widgetData}
        userFonts={userFonts}
      />
    </div>
  );
}

function ElementContent({
  element,
  theme,
  preview,
  widgetData,
  userFonts,
}: {
  element: Element;
  theme: Theme;
  preview: boolean;
  widgetData: Record<string, WidgetData | undefined>;
  userFonts: UserFontRecord[];
}) {
  const override = readBlockTypographyOverride(element.meta);
  const radiusClass = buttonRadiusClass(theme.button_shape);
  const extraButtonStyle = buttonExtraStyle(theme.button_style);

  if (element.type === "heading") {
    return (
      <h2
        className="w-full h-full flex items-center justify-center text-xl font-bold text-center"
        style={{
          color: theme.text_color,
          ...resolveElementTypography(theme.typography, "heading", override, userFonts),
        }}
      >
        {element.content}
      </h2>
    );
  }
  if (element.type === "text") {
    return (
      <p
        className="w-full h-full whitespace-pre-wrap text-center text-sm leading-relaxed"
        style={{
          color: theme.muted_color,
          ...resolveElementTypography(theme.typography, "body", override, userFonts),
        }}
      >
        {element.content}
      </p>
    );
  }
  if (element.type === "divider") {
    return (
      <hr
        className="w-full border-0 h-px"
        style={{ backgroundColor: theme.muted_color, opacity: 0.3, marginTop: (element.h - 1) / 2 }}
      />
    );
  }
  if (element.type === "link") {
    if (!element.url || !element.title) return null;
    return (
      <a
        href={preview ? "#" : `/r/${element.id}`}
        target={preview ? undefined : "_blank"}
        rel={preview ? undefined : "noopener noreferrer"}
        onClick={preview ? (e) => e.preventDefault() : undefined}
        className={`w-full h-full flex items-center justify-between border px-5 transition hover:opacity-90 ${radiusClass}`}
        style={{
          backgroundColor: theme.button_bg,
          color: theme.button_text,
          borderColor: theme.button_border,
          ...resolveElementTypography(theme.typography, "ui", override, userFonts),
          ...extraButtonStyle,
        }}
      >
        <span className="font-medium truncate">{element.title}</span>
        <ExternalLink className="h-4 w-4 opacity-60 shrink-0" />
      </a>
    );
  }
  if (element.type === "widget") {
    return (
      <WidgetElement
        element={element}
        theme={theme}
        widgetData={widgetData}
        preview={preview}
      />
    );
  }
  return null;
}

function WidgetElement({
  element,
  theme,
  widgetData,
  preview,
}: {
  element: Element;
  theme: Theme;
  widgetData: Record<string, WidgetData | undefined>;
  preview: boolean;
}) {
  const wd = widgetData[element.id];
  const size: WidgetSize = isWidgetSize((element.meta as { size?: unknown } | null)?.size)
    ? ((element.meta as { size: WidgetSize }).size)
    : "default";
  const kind = element.widget_kind;
  const meta = (element.meta ?? {}) as Record<string, unknown>;

  if (kind === "twitch_live") {
    const channel = (meta.channel as string | undefined) ?? element.title ?? "";
    const data = wd?.kind === "twitch_live" ? wd.data : null;
    return <TwitchLiveWidget channel={channel} data={data} theme={theme} size={size} preview={preview} />;
  }
  if (kind === "twitch_vod") {
    const channel = (meta.channel as string | undefined) ?? element.title ?? "";
    const data = wd?.kind === "twitch_vod" ? wd.data : null;
    return <TwitchVodWidget channel={channel} data={data} theme={theme} size={size} preview={preview} />;
  }
  if (kind === "youtube_live") {
    const data = wd?.kind === "youtube_live" ? wd.data : null;
    return (
      <YouTubeLiveWidget
        data={data}
        fallbackUrl={youtubeFallback(meta)}
        theme={theme}
        size={size}
        preview={preview}
      />
    );
  }
  if (kind === "youtube_channel") {
    const data = wd?.kind === "youtube_channel" ? wd.data : null;
    return (
      <YouTubeChannelWidget
        data={data}
        fallbackUrl={youtubeFallback(meta)}
        theme={theme}
        size={size}
        preview={preview}
      />
    );
  }
  if (kind === "youtube_video") {
    const data = wd?.kind === "youtube_video" ? wd.data : null;
    const fallbackUrl = (meta.video_id as string | undefined)
      ? `https://youtube.com/watch?v=${meta.video_id as string}`
      : youtubeFallback(meta);
    return (
      <YouTubeVideoWidget
        data={data}
        fallbackUrl={fallbackUrl}
        theme={theme}
        size={size}
        preview={preview}
      />
    );
  }
  if (kind === "og_card") {
    const data = wd?.kind === "og_card" ? wd.data : null;
    return (
      <OgCardWidget
        data={data}
        fallbackUrl={(meta.url as string | undefined) ?? "#"}
        theme={theme}
        size={size}
        preview={preview}
      />
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
        theme={theme}
        size={size}
        preview={preview}
      />
    );
  }
  if (kind === "github_user") {
    const username = meta.username as string | undefined;
    const data = wd?.kind === "github_user" ? wd.data : null;
    return (
      <GitHubUserWidget
        data={data}
        fallbackUrl={username ? `https://github.com/${username}` : "https://github.com"}
        theme={theme}
        size={size}
        preview={preview}
      />
    );
  }
  if (kind === "discord_invite") {
    const data = wd?.kind === "discord_invite" ? wd.data : null;
    return (
      <DiscordInviteWidget
        inviteCode={(meta.invite_code as string | undefined) ?? ""}
        data={data}
        theme={theme}
        size={size}
        preview={preview}
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
    const username = meta.username as string | undefined;
    const video_id = meta.video_id as string | undefined;
    if (!username || !video_id) return null;
    return <TikTokVideoWidget username={username} videoId={video_id} theme={theme} size={size} preview={preview} />;
  }
  return null;
}

function youtubeFallback(meta: Record<string, unknown>): string {
  const handle = meta.handle as string | undefined;
  const channel_id = meta.channel_id as string | undefined;
  if (handle) return `https://youtube.com/@${handle}`;
  if (channel_id) return `https://youtube.com/channel/${channel_id}`;
  return "https://youtube.com";
}
