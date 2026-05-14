import type { YouTubeVideoData } from "@/lib/widgets/types";
import type { Theme } from "@/lib/themes";

export function YouTubeVideoWidget({
  data,
  fallbackUrl,
  theme,
  preview = false,
}: {
  data: YouTubeVideoData | null;
  fallbackUrl: string;
  theme: Theme;
  preview?: boolean;
}) {
  const video = data?.video;
  const href = preview
    ? "#"
    : video
      ? `https://youtube.com/watch?v=${video.id}`
      : fallbackUrl;

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
      {video?.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={video.thumbnail_url}
          alt={video.title}
          className="w-full aspect-video object-cover"
        />
      ) : (
        <div
          className="w-full aspect-video"
          style={{ backgroundColor: theme.muted_color, opacity: 0.2 }}
        />
      )}
      <div className="p-3 space-y-1">
        <div className="flex items-center gap-2">
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
          {video?.view_count != null && (
            <span className="text-xs" style={{ color: theme.muted_color }}>
              {formatCount(video.view_count)} views
            </span>
          )}
          {video?.published_at && (
            <span className="text-xs" style={{ color: theme.muted_color }}>
              · {timeAgo(video.published_at)}
            </span>
          )}
        </div>
        <p className="text-sm font-medium line-clamp-2" style={{ color: theme.text_color }}>
          {video?.title ?? "Latest video"}
        </p>
        {video?.channel_title && (
          <p className="text-xs truncate" style={{ color: theme.muted_color }}>
            {video.channel_title}
          </p>
        )}
      </div>
    </a>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
