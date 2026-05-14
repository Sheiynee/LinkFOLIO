import type { TwitchVodData } from "@/lib/widgets/types";
import type { Theme } from "@/lib/themes";

export function TwitchVodWidget({
  channel,
  data,
  theme,
  preview = false,
}: {
  channel: string;
  data: TwitchVodData | null;
  theme: Theme;
  preview?: boolean;
}) {
  const vod = data?.video;
  const user = data?.user;
  const href = preview
    ? "#"
    : vod?.url ?? `https://twitch.tv/${channel}/videos`;

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
      {vod?.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={vod.thumbnail_url}
          alt={vod.title}
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
            twitch · vod
          </span>
          {vod && (
            <>
              <span className="text-xs" style={{ color: theme.muted_color }}>
                {formatCount(vod.view_count)} views
              </span>
              <span className="text-xs" style={{ color: theme.muted_color }}>
                · {timeAgo(vod.published_at)}
              </span>
            </>
          )}
        </div>
        <p className="text-sm font-medium line-clamp-2" style={{ color: theme.text_color }}>
          {vod?.title ?? "Latest VOD"}
        </p>
        {user && (
          <p className="text-xs truncate" style={{ color: theme.muted_color }}>
            {user.display_name}
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
