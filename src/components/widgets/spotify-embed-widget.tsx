import type { Theme } from "@/lib/themes";
import { type SpotifyEntityType, spotifyEmbedUrl, spotifyOpenUrl } from "@/lib/widgets/spotify";

const HEIGHT_FOR: Record<SpotifyEntityType, number> = {
  track: 152,
  episode: 152,
  album: 352,
  playlist: 352,
  artist: 352,
  show: 232,
};

export function SpotifyEmbedWidget({
  type,
  id,
  theme,
  preview = false,
}: {
  type: SpotifyEntityType;
  id: string;
  theme: Theme;
  preview?: boolean;
}) {
  const height = HEIGHT_FOR[type];
  const embedSrc = spotifyEmbedUrl(type, id);
  const openUrl = spotifyOpenUrl(type, id);

  if (preview) {
    return (
      <a
        href="#"
        onClick={(e) => e.preventDefault()}
        className="block w-full rounded-2xl border overflow-hidden transition hover:opacity-95"
        style={{
          backgroundColor: theme.button_bg,
          color: theme.button_text,
          borderColor: theme.button_border,
        }}
      >
        <div className="flex items-center gap-3 p-3">
          <div
            className="h-12 w-12 rounded-2xl shrink-0 flex items-center justify-center text-xl"
            style={{ backgroundColor: "#1DB954", color: "#000" }}
          >
            ♪
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold truncate">Spotify {type}</span>
              <span
                className="text-xs px-1.5 py-0.5 rounded font-mono shrink-0"
                style={{
                  backgroundColor: theme.button_bg,
                  color: theme.muted_color,
                  border: `1px solid ${theme.button_border}`,
                }}
              >
                spotify
              </span>
            </div>
            <p className="text-xs truncate" style={{ color: theme.muted_color }}>
              Embedded player on the live page
            </p>
          </div>
        </div>
      </a>
    );
  }

  return (
    <div
      className="w-full rounded-2xl overflow-hidden border"
      style={{ borderColor: theme.button_border }}
    >
      <iframe
        src={embedSrc}
        width="100%"
        height={height}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        title={`Spotify ${type}`}
        style={{ border: 0, display: "block" }}
      />
      {/* Accessible fallback link (also bumps SEO) */}
      <a
        href={openUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="sr-only"
      >
        Open in Spotify
      </a>
    </div>
  );
}
