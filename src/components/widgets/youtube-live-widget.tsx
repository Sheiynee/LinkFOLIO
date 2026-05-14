import type { YouTubeLiveData } from "@/lib/widgets/types";
import type { Theme } from "@/lib/themes";
import { UpdatedAgo } from "./updated-ago";

export function YouTubeLiveWidget({
  data,
  fallbackUrl,
  theme,
  preview = false,
}: {
  data: YouTubeLiveData | null;
  fallbackUrl: string;
  theme: Theme;
  preview?: boolean;
}) {
  const live = data?.live;
  const channel = data?.channel;
  const href = preview
    ? "#"
    : live
      ? `https://youtube.com/watch?v=${live.video_id}`
      : channel?.custom_url
        ? `https://youtube.com/${channel.custom_url}`
        : channel
          ? `https://youtube.com/channel/${channel.id}`
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
      <div className="flex items-center gap-3 p-3">
        {channel?.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channel.thumbnail_url}
            alt={channel.title}
            className="h-12 w-12 rounded-full object-cover shrink-0"
          />
        ) : (
          <div
            className="h-12 w-12 rounded-full shrink-0"
            style={{ backgroundColor: theme.muted_color, opacity: 0.3 }}
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold truncate">
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
          {live ? (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <LivePulse color="#ef4444" />
                <span
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: "#ef4444" }}
                >
                  Live
                </span>
              </div>
              <p className="text-sm truncate" style={{ color: theme.text_color }}>
                {live.title}
              </p>
            </div>
          ) : (
            <p className="text-xs" style={{ color: theme.muted_color }}>
              {data ? "Offline" : "Channel not found"}
            </p>
          )}
        </div>
        {data && (
          <div className="self-start">
            <UpdatedAgo fetchedAt={data.fetched_at} color={theme.muted_color} />
          </div>
        )}
      </div>
    </a>
  );
}

function LivePulse({ color }: { color: string }) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex rounded-full h-2 w-2"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}
