export type SpotifyEntityType = "track" | "album" | "artist" | "playlist" | "episode" | "show";

export interface ParsedSpotify {
  type: SpotifyEntityType;
  id: string;
}

const SUPPORTED: SpotifyEntityType[] = ["track", "album", "artist", "playlist", "episode", "show"];

export function parseSpotifyUrl(input: string): ParsedSpotify | null {
  const trimmed = input.trim();

  const urlMatch = trimmed.match(
    /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|artist|playlist|episode|show)\/([a-zA-Z0-9]{22})/i
  );
  if (urlMatch) {
    const type = urlMatch[1].toLowerCase() as SpotifyEntityType;
    if (SUPPORTED.includes(type)) return { type, id: urlMatch[2] };
  }

  const uriMatch = trimmed.match(/spotify:(track|album|artist|playlist|episode|show):([a-zA-Z0-9]{22})/i);
  if (uriMatch) {
    const type = uriMatch[1].toLowerCase() as SpotifyEntityType;
    if (SUPPORTED.includes(type)) return { type, id: uriMatch[2] };
  }

  return null;
}

export function spotifyEmbedUrl(type: SpotifyEntityType, id: string): string {
  return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
}

export function spotifyOpenUrl(type: SpotifyEntityType, id: string): string {
  return `https://open.spotify.com/${type}/${id}`;
}
