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
import { YouTubeChannelWidget } from "./widgets/youtube-channel-widget";
import { YouTubeVideoWidget } from "./widgets/youtube-video-widget";

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
                return null;
              }
              default:
                return null;
            }
          })
        )}
      </div>

      <p className="mt-12 text-xs" style={{ color: theme.muted_color }}>
        Powered by <span style={{ color: theme.accent_color }}>LinkFolio</span>
      </p>
    </div>
  );
}
