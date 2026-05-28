import type { SteamProfileData, WidgetSize } from "@/lib/widgets/types";
import type { Theme } from "@/lib/themes";
import { CompactRow } from "./compact-row";

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return `${h}h`;
}

export function SteamProfileWidget({
  username,
  data,
  theme,
  size = "default",
  preview = false,
}: {
  username: string;
  data: SteamProfileData | null;
  theme: Theme;
  size?: WidgetSize;
  preview?: boolean;
}) {
  const href = preview ? "#" : (data?.profile_url ?? `https://steamcommunity.com/id/${username}`);

  if (size === "compact") {
    return (
      <CompactRow
        href={href}
        preview={preview}
        theme={theme}
        icon={
          data?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.avatar_url} alt={data.username} className="h-6 w-6 rounded object-cover" />
          ) : (
            <span className="inline-block h-6 w-6 rounded" style={{ background: "#1b2838" }} />
          )
        }
        title={data?.username ?? username}
        trailing={data?.is_online ? "online" : data ? "offline" : null}
        tag="steam"
      />
    );
  }

  return (
    <a
      href={href}
      target={preview ? undefined : "_blank"}
      rel={preview ? undefined : "noopener noreferrer"}
      onClick={preview ? (e) => e.preventDefault() : undefined}
      className="block w-full rounded-2xl border overflow-hidden transition hover:opacity-95"
      style={{ backgroundColor: theme.button_bg, color: theme.button_text, borderColor: theme.button_border }}
    >
      {/* Profile row */}
      <div className="flex items-center gap-3 p-3">
        {data?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.avatar_url} alt={data.username} className="h-12 w-12 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="h-12 w-12 rounded-lg shrink-0" style={{ background: "#1b2838" }} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold truncate">{data?.username ?? username}</span>
            <span className="text-xs px-1.5 py-0.5 rounded font-mono shrink-0"
              style={{ backgroundColor: theme.button_bg, color: theme.muted_color, border: `1px solid ${theme.button_border}` }}>
              steam
            </span>
          </div>
          {data ? (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: theme.muted_color }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: data.is_online ? "#57cbde" : theme.muted_color }} />
              {data.currently_playing
                ? <span className="truncate">Playing {data.currently_playing}</span>
                : <span>{data.persona_state}</span>
              }
            </div>
          ) : (
            <p className="text-xs" style={{ color: theme.muted_color }}>Steam profile</p>
          )}
        </div>
      </div>

      {/* Recent games — only in featured or when there's data and space */}
      {data && data.recent_games.length > 0 && size === "featured" && (
        <div className="border-t px-3 pb-3 pt-2" style={{ borderColor: theme.button_border }}>
          <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: theme.muted_color }}>
            Recently played
          </p>
          <div className="space-y-1.5">
            {data.recent_games.map((g) => (
              <div key={g.appid} className="flex items-center gap-2">
                {g.icon_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.icon_url} alt={g.name} className="h-5 w-5 rounded shrink-0" />
                ) : (
                  <div className="h-5 w-5 rounded shrink-0" style={{ background: "#1b2838" }} />
                )}
                <span className="text-xs truncate flex-1">{g.name}</span>
                {g.playtime_2weeks > 0 && (
                  <span className="text-[10px] shrink-0" style={{ color: theme.muted_color }}>
                    {formatMinutes(g.playtime_2weeks)} this week
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show one recent game in default size */}
      {data && data.recent_games.length > 0 && size === "default" && !data.currently_playing && (
        <div className="border-t px-3 py-2 flex items-center gap-2" style={{ borderColor: theme.button_border }}>
          {data.recent_games[0].icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.recent_games[0].icon_url} alt={data.recent_games[0].name} className="h-4 w-4 rounded shrink-0" />
          ) : null}
          <span className="text-xs truncate" style={{ color: theme.muted_color }}>
            Recently played: {data.recent_games[0].name}
          </span>
        </div>
      )}
    </a>
  );
}
