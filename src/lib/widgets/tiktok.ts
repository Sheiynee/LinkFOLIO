export interface ParsedTikTok {
  kind: "tiktok_video";
  video_url: string;
  username: string;
  video_id: string;
}

export function parseTikTokUrl(input: string): ParsedTikTok | null {
  const m = input.trim().match(
    /tiktok\.com\/@([a-zA-Z0-9._]{2,24})\/video\/(\d{10,25})/i
  );
  if (!m) return null;
  const username = m[1];
  const video_id = m[2];
  return {
    kind: "tiktok_video",
    video_url: `https://www.tiktok.com/@${username}/video/${video_id}`,
    username,
    video_id,
  };
}
