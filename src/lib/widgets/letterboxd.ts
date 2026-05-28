import "server-only";
import type { LetterboxdFilmsData, LetterboxdFilm } from "./types";

export function parseLetterboxdUsername(input: string): string | null {
  const trimmed = input.trim();
  const m = trimmed.match(/letterboxd\.com\/([a-zA-Z0-9_]+)/i);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_]{1,15}$/.test(trimmed)) return trimmed;
  return null;
}

function extractCdata(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, "s");
  return xml.match(re)?.[1]?.trim() ?? null;
}

export async function getLetterboxdFilms(username: string): Promise<LetterboxdFilmsData | null> {
  const res = await fetch(`https://letterboxd.com/${encodeURIComponent(username)}/rss/`, {
    next: { revalidate: 1800 },
    headers: { "User-Agent": "LinkFolio/1.0 (https://github.com/Sheiynee/LinkFOLIO)" },
  });
  if (!res.ok) return null;

  const xml = await res.text();
  const itemMatches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).slice(0, 5);
  if (itemMatches.length === 0) return null;

  const films: LetterboxdFilm[] = itemMatches.map(([, inner]) => {
    const title = extractCdata(inner, "letterboxd:filmTitle") ?? "Unknown film";
    const yearStr = extractCdata(inner, "letterboxd:filmYear");
    const ratingStr = extractCdata(inner, "letterboxd:memberRating");
    const watchedDate = extractCdata(inner, "letterboxd:watchedDate");
    const link = inner.match(/<link>([^<\s]+)<\/link>/)?.[1] ?? `https://letterboxd.com/${username}/films/`;
    const posterMatch = inner.match(/<img src="(https:\/\/a\.ltrbxd\.com\/resized\/[^"]+)"/);

    return {
      title,
      year: yearStr ? parseInt(yearStr, 10) : null,
      rating: ratingStr ? parseFloat(ratingStr) : null,
      watched_date: watchedDate,
      link,
      poster_url: posterMatch?.[1] ?? null,
    };
  });

  return { username, films, profile_url: `https://letterboxd.com/${username}/` };
}
