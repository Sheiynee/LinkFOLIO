import type { LetterboxdFilmsData, WidgetSize } from "@/lib/widgets/types";
import type { Theme } from "@/lib/themes";
import { CompactRow } from "./compact-row";

const LBX_GREEN = "#00e054";
const LBX_ORANGE = "#ff8000";

function RatingStars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <span style={{ color: LBX_ORANGE, fontSize: "0.7rem" }}>
      {"â˜…".repeat(full)}{half ? "Â½" : ""}
    </span>
  );
}

export function LetterboxdFilmsWidget({
  username,
  data,
  theme,
  size = "default",
  preview = false,
}: {
  username: string;
  data: LetterboxdFilmsData | null;
  theme: Theme;
  size?: WidgetSize;
  preview?: boolean;
}) {
  const href = preview ? "#" : (data?.profile_url ?? `https://letterboxd.com/${username}/`);
  const topFilm = data?.films[0] ?? null;

  if (size === "compact") {
    return (
      <CompactRow
        href={href}
        preview={preview}
        theme={theme}
        icon={
          <span className="inline-flex h-6 w-6 rounded items-center justify-center text-sm font-bold" style={{ background: LBX_GREEN, color: "#000" }}>
            LB
          </span>
        }
        title={topFilm ? `${topFilm.title}${topFilm.year ? ` (${topFilm.year})` : ""}` : `${username} on Letterboxd`}
        trailing={topFilm?.rating != null ? <RatingStars rating={topFilm.rating} /> : null}
        tag="letterboxd"
      />
    );
  }

  if (size === "featured") {
    return (
      <a
        href={href}
        target={preview ? undefined : "_blank"}
        rel={preview ? undefined : "noopener noreferrer"}
        onClick={preview ? (e) => e.preventDefault() : undefined}
        className="block w-full rounded-2xl border overflow-hidden transition hover:opacity-95"
        style={{ backgroundColor: theme.button_bg, color: theme.button_text, borderColor: theme.button_border }}
      >
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: LBX_GREEN }}>
            Recently watched
          </span>
          <span className="ml-auto text-[10px] uppercase tracking-wide" style={{ color: theme.muted_color }}>
            letterboxd
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 px-3 pb-3">
          {data ? (
            data.films.slice(0, 3).map((film, i) => (
              <div key={i} className="flex flex-col gap-1">
                {film.poster_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img loading="lazy" decoding="async" src={film.poster_url} alt={film.title} className="w-full rounded aspect-[2/3] object-cover" />
                ) : (
                  <div className="w-full rounded aspect-[2/3] flex items-center justify-center text-xs font-bold"
                    style={{ background: "#14181c", color: LBX_GREEN }}>
                    LB
                  </div>
                )}
                <p className="text-xs font-medium truncate leading-tight">{film.title}</p>
                {film.rating != null && <RatingStars rating={film.rating} />}
              </div>
            ))
          ) : (
            <div className="col-span-3 py-4 text-sm text-center" style={{ color: theme.muted_color }}>
              No films logged yet
            </div>
          )}
        </div>
      </a>
    );
  }

  // Default size
  return (
    <a
      href={topFilm ? (preview ? "#" : topFilm.link) : href}
      target={preview ? undefined : "_blank"}
      rel={preview ? undefined : "noopener noreferrer"}
      onClick={preview ? (e) => e.preventDefault() : undefined}
      className="block w-full rounded-2xl border overflow-hidden transition hover:opacity-95"
      style={{ backgroundColor: theme.button_bg, color: theme.button_text, borderColor: theme.button_border }}
    >
      <div className="flex gap-3 p-3">
        {topFilm?.poster_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img loading="lazy" decoding="async" src={topFilm.poster_url} alt={topFilm.title}
            className="h-20 w-14 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="h-20 w-14 rounded-lg shrink-0 flex items-center justify-center text-lg font-bold"
            style={{ background: "#14181c", color: LBX_GREEN }}>
            LB
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide font-bold" style={{ color: LBX_GREEN }}>
              Recently watched
            </span>
          </div>
          <p className="font-semibold leading-tight truncate">
            {topFilm?.title ?? "No films yet"}
            {topFilm?.year ? <span className="font-normal text-sm ml-1" style={{ color: theme.muted_color }}>({topFilm.year})</span> : null}
          </p>
          {topFilm?.rating != null && <RatingStars rating={topFilm.rating} />}
          {topFilm?.watched_date && (
            <p className="text-xs" style={{ color: theme.muted_color }}>{topFilm.watched_date}</p>
          )}
          <p className="text-xs mt-auto" style={{ color: theme.muted_color }}>
            {username} Â· letterboxd
          </p>
        </div>
      </div>
    </a>
  );
}
