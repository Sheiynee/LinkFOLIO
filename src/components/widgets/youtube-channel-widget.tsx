import type { YouTubeChannelData, WidgetSize } from "@/lib/widgets/types";
import type { Theme } from "@/lib/themes";
import { CompactRow } from "./compact-row";

export function YouTubeChannelWidget({
  data,
  fallbackUrl,
  theme,
  size = "default",
  preview = false,
}: {
  data: YouTubeChannelData | null;
  fallbackUrl: string;
  theme: Theme;
  size?: WidgetSize;
  preview?: boolean;
}) {
  const channel = data?.channel;
  const href = preview
    ? "#"
    : channel?.custom_url
      ? `https://youtube.com/${channel.custom_url}`
      : channel
        ? `https://youtube.com/channel/${channel.id}`
        : fallbackUrl;

  if (size === "compact") {
    return (
      <CompactRow
        href={href}
        preview={preview}
        theme={theme}
        icon={
          channel?.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={channel.thumbnail_url} alt={channel.title} className="h-6 w-6 rounded-full object-cover" />
          ) : null
        }
        title={channel?.title ?? "YouTube channel"}
        trailing={channel ? `${formatCount(channel.subscriber_count)} subs` : null}
        tag="youtube"
      />
    );
  }

  const isFeatured = size === "featured";

  return (
    <a
      href={href}
      target={preview ? undefined : "_blank"}
      rel={preview ? undefined : "noopener noreferrer"}
      onClick={preview ? (e) => e.preventDefault() : undefined}
      className="block w-full rounded-2xl border overflow-hidden transition hover:opacity-95"
      style={{
        backgroundColor: theme.button_bg,
        color: theme.button_text,
        borderColor: theme.button_border,
      }}
    >
      <div className={`flex items-center gap-3 ${isFeatured ? "p-4" : "p-3"}`}>
        {channel?.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channel.thumbnail_url}
            alt={channel.title}
            className={`${isFeatured ? "h-20 w-20" : "h-12 w-12"} rounded-full object-cover shrink-0`}
          />
        ) : (
          <div
            className={`${isFeatured ? "h-20 w-20" : "h-12 w-12"} rounded-full shrink-0`}
            style={{ backgroundColor: theme.muted_color, opacity: 0.3 }}
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`${isFeatured ? "text-xl" : ""} font-semibold truncate`}>
              {channel?.title ?? "YouTube channel"}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded font-mono shrink-0"
              style={{
                backgroundColor: theme.button_bg,
                color: theme.muted_color,
                border: `1px solid ${theme.button_border}`,
              }}
            >
              youtube
            </span>
          </div>
          {channel ? (
            <p className="text-xs" style={{ color: theme.muted_color }}>
              {formatCount(channel.subscriber_count)} subscribers · {formatCount(channel.video_count)} videos
            </p>
          ) : (
            <p className="text-xs" style={{ color: theme.muted_color }}>
              Channel not found
            </p>
          )}
        </div>
      </div>
    </a>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
