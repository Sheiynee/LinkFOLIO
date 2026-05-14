import "server-only";
import type { YouTubeChannelData, YouTubeVideoData } from "./types";

const BASE = "https://www.googleapis.com/youtube/v3";

async function ytFetch<T>(
  path: string,
  params: Record<string, string>,
  revalidate: number
): Promise<T | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), {
    next: { revalidate, tags: ["youtube"] },
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

interface ChannelsResponse {
  items?: Array<{
    id: string;
    snippet: {
      title: string;
      description: string;
      customUrl?: string;
      thumbnails: { default?: { url: string }; medium?: { url: string }; high?: { url: string } };
    };
    statistics: {
      viewCount?: string;
      subscriberCount?: string;
      videoCount?: string;
    };
    contentDetails: {
      relatedPlaylists: { uploads: string };
    };
  }>;
}

interface PlaylistItemsResponse {
  items?: Array<{
    snippet: {
      title: string;
      publishedAt: string;
      channelTitle: string;
      resourceId: { videoId: string };
      thumbnails: { default?: { url: string }; medium?: { url: string }; high?: { url: string } };
    };
  }>;
}

interface VideosResponse {
  items?: Array<{
    id: string;
    snippet: {
      title: string;
      channelTitle: string;
      publishedAt: string;
      thumbnails: { default?: { url: string }; medium?: { url: string }; high?: { url: string } };
    };
    statistics: { viewCount?: string };
  }>;
}

function resolveThumb(thumbs: { default?: { url: string }; medium?: { url: string }; high?: { url: string } }): string {
  return thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url ?? "";
}

async function lookupChannel(meta: { channel_id?: string; handle?: string }) {
  const params: Record<string, string> = {
    part: "snippet,statistics,contentDetails",
  };
  if (meta.channel_id) params.id = meta.channel_id;
  else if (meta.handle) params.forHandle = meta.handle.replace(/^@/, "");
  else return null;

  const res = await ytFetch<ChannelsResponse>("/channels", params, 60 * 60);
  return res?.items?.[0] ?? null;
}

export async function getYouTubeChannel(
  meta: { channel_id?: string; handle?: string }
): Promise<YouTubeChannelData | null> {
  const item = await lookupChannel(meta);
  if (!item) return null;
  return {
    channel: {
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      custom_url: item.snippet.customUrl ?? null,
      thumbnail_url: resolveThumb(item.snippet.thumbnails),
      subscriber_count: Number(item.statistics.subscriberCount ?? 0),
      video_count: Number(item.statistics.videoCount ?? 0),
      view_count: Number(item.statistics.viewCount ?? 0),
    },
  };
}

export async function getYouTubeLatestVideo(
  meta: { video_id?: string; channel_id?: string; handle?: string }
): Promise<YouTubeVideoData | null> {
  let videoId = meta.video_id;

  if (!videoId) {
    const channel = await lookupChannel({ channel_id: meta.channel_id, handle: meta.handle });
    if (!channel) return null;
    const uploads = channel.contentDetails.relatedPlaylists.uploads;
    const playlist = await ytFetch<PlaylistItemsResponse>(
      "/playlistItems",
      { part: "snippet", playlistId: uploads, maxResults: "1" },
      60 * 5
    );
    videoId = playlist?.items?.[0]?.snippet.resourceId.videoId;
    if (!videoId) return null;
  }

  const videos = await ytFetch<VideosResponse>(
    "/videos",
    { part: "snippet,statistics", id: videoId },
    60 * 5
  );
  const item = videos?.items?.[0];
  if (!item) return null;
  return {
    video: {
      id: item.id,
      title: item.snippet.title,
      channel_title: item.snippet.channelTitle,
      published_at: item.snippet.publishedAt,
      thumbnail_url: resolveThumb(item.snippet.thumbnails),
      view_count: item.statistics.viewCount ? Number(item.statistics.viewCount) : null,
    },
  };
}

export interface ParsedYouTubeUrl {
  kind: "youtube_video" | "youtube_channel";
  video_id?: string;
  channel_id?: string;
  handle?: string;
}

export function parseYouTubeUrl(input: string): ParsedYouTubeUrl | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const watchMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return { kind: "youtube_video", video_id: watchMatch[1] };

  const channelIdMatch = trimmed.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/);
  if (channelIdMatch) return { kind: "youtube_channel", channel_id: channelIdMatch[1] };

  const handleMatch = trimmed.match(/youtube\.com\/@([a-zA-Z0-9._-]+)/);
  if (handleMatch) return { kind: "youtube_channel", handle: handleMatch[1] };

  if (/^@[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return { kind: "youtube_channel", handle: trimmed.slice(1) };
  }

  return null;
}
