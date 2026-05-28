import type { LastFmScrobblesData, WidgetSize } from "@/lib/widgets/types";
import type { Theme } from "@/lib/themes";
import { CompactRow } from "./compact-row";

const LASTFM_RED = "#d51007";

export function LastFmScrobblesWidget({
  username,
  data,
  theme,
  size = "default",
  preview = false,
}: {
  username: string;
  data: LastFmScrobblesData | null;
  theme: Theme;
  size?: WidgetSize;
  preview?: boolean;
}) {
  const href = preview ? "#" : (data?.user_url ?? `https://www.last.fm/user/${username}`);
  const topTrack = data?.tracks[0] ?? null;
  const isNowPlaying = topTrack?.now_playing === true;

  if (size === "compact") {
    return (
      <CompactRow
        href={href}
        preview={preview}
        theme={theme}
        icon={
          topTrack?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={topTrack.image_url} alt={topTrack.name} className="h-6 w-6 rounded object-cover" />
          ) : (
            <span className="inline-flex h-6 w-6 rounded items-center justify-center text-xs font-bold" style={{ background: LASTFM_RED, color: "#fff" }}>♫</span>
          )
        }
        title={topTrack ? `${topTrack.artist} — ${topTrack.name}` : `${username} on Last.fm`}
        trailing={isNowPlaying ? "now playing" : null}
        tag="last.fm"
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
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: LASTFM_RED }}>
          {isNowPlaying ? "▶ Now playing" : "Recently scrobbled"}
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-wide" style={{ color: theme.muted_color }}>
          last.fm
        </span>
      </div>

      {size === "featured" ? (
        // Featured: show up to 3 tracks
        <div className="divide-y" style={{ borderColor: theme.button_border }}>
          {data ? (
            data.tracks.slice(0, 3).map((track, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                {track.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={track.image_url} alt={track.name} className="h-10 w-10 rounded object-cover shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded shrink-0 flex items-center justify-center text-sm" style={{ background: LASTFM_RED, color: "#fff" }}>♫</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{track.name}</p>
                  <p className="text-xs truncate" style={{ color: theme.muted_color }}>{track.artist}</p>
                </div>
                {track.now_playing && (
                  <span className="text-[10px] uppercase shrink-0" style={{ color: LASTFM_RED }}>live</span>
                )}
              </div>
            ))
          ) : (
            <div className="px-3 py-4 text-sm text-center" style={{ color: theme.muted_color }}>
              No scrobbles yet
            </div>
          )}
        </div>
      ) : (
        // Default: top track with album art
        <div className="flex items-center gap-3 px-3 pb-3">
          {topTrack?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={topTrack.image_url} alt={topTrack.name} className="h-14 w-14 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="h-14 w-14 rounded-lg shrink-0 flex items-center justify-center text-2xl" style={{ background: LASTFM_RED, color: "#fff" }}>♫</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{topTrack?.name ?? "No recent tracks"}</p>
            <p className="text-sm truncate" style={{ color: theme.muted_color }}>{topTrack?.artist ?? username}</p>
            {topTrack?.album && (
              <p className="text-xs truncate" style={{ color: theme.muted_color }}>{topTrack.album}</p>
            )}
          </div>
        </div>
      )}
    </a>
  );
}
