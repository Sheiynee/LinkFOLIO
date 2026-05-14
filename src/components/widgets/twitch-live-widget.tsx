import type { TwitchLiveData } from "@/lib/widgets/types";
import type { Theme } from "@/lib/themes";
import { UpdatedAgo } from "./updated-ago";

export function TwitchLiveWidget({
  channel,
  data,
  theme,
  preview = false,
}: {
  channel: string;
  data: TwitchLiveData | null;
  theme: Theme;
  preview?: boolean;
}) {
  const live = data?.stream;
  const user = data?.user;

  const href = preview ? "#" : `https://twitch.tv/${channel}`;

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
        {user?.profile_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.profile_image_url}
            alt={user.display_name}
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
              {user?.display_name ?? channel}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded font-mono shrink-0" style={{ backgroundColor: theme.button_bg, color: theme.muted_color, border: `1px solid ${theme.button_border}` }}>
              twitch
            </span>
          </div>

          {live ? (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <LivePulse color="#ef4444" />
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#ef4444" }}>
                  Live
                </span>
                <span className="text-xs" style={{ color: theme.muted_color }}>
                  · {formatViewers(live.viewer_count)} viewers
                </span>
              </div>
              <p className="text-sm truncate" style={{ color: theme.text_color }}>
                {live.title}
              </p>
              {live.game_name && (
                <p className="text-xs truncate" style={{ color: theme.muted_color }}>
                  Playing {live.game_name}
                </p>
              )}
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

function formatViewers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
