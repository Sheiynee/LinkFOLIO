import type { CrossPromoPlatform, CrossPromoMeta } from "./types";

export interface CrossPromoConfig {
  platform: CrossPromoPlatform;
  label: string;
  defaultCta: string;
  bgColor: string;
  textColor: string;
  gradientFrom: string;
  gradientTo: string;
}

export const CROSS_PROMO_CONFIG: Record<CrossPromoPlatform, CrossPromoConfig> = {
  twitch:    { platform: "twitch",    label: "Twitch",    defaultCta: "Follow on Twitch",    bgColor: "#9146ff", textColor: "#fff", gradientFrom: "#9146ff", gradientTo: "#6441a5" },
  youtube:   { platform: "youtube",   label: "YouTube",   defaultCta: "Subscribe on YouTube", bgColor: "#ff0000", textColor: "#fff", gradientFrom: "#ff0000", gradientTo: "#cc0000" },
  tiktok:    { platform: "tiktok",    label: "TikTok",    defaultCta: "Follow on TikTok",     bgColor: "#010101", textColor: "#fff", gradientFrom: "#010101", gradientTo: "#333" },
  spotify:   { platform: "spotify",   label: "Spotify",   defaultCta: "Follow on Spotify",    bgColor: "#1db954", textColor: "#fff", gradientFrom: "#1db954", gradientTo: "#158a3e" },
  instagram: { platform: "instagram", label: "Instagram", defaultCta: "Follow on Instagram",  bgColor: "#e1306c", textColor: "#fff", gradientFrom: "#833ab4", gradientTo: "#e1306c" },
  twitter:   { platform: "twitter",   label: "Twitter/X", defaultCta: "Follow on Twitter",    bgColor: "#1da1f2", textColor: "#fff", gradientFrom: "#1da1f2", gradientTo: "#0d8bd9" },
};

interface CrossPromoDetected {
  meta: CrossPromoMeta;
  title: string;
}

function extractInstagramHandle(url: string): string | null {
  const m = url.match(/instagram\.com\/([a-zA-Z0-9_.]{1,30})\/?/);
  const handle = m?.[1];
  if (!handle || ["p", "reel", "stories", "explore", "tv"].includes(handle)) return null;
  return handle;
}

function extractTwitterHandle(url: string): string | null {
  const m = url.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]{1,50})\/?/);
  const handle = m?.[1];
  if (!handle || ["home", "explore", "notifications", "messages", "i", "search"].includes(handle)) return null;
  return handle;
}

export function detectCrossPromoFromUrl(input: string): CrossPromoDetected | null {
  const raw = input.trim();

  // Twitch
  const twitchM = raw.match(/twitch\.tv\/([a-zA-Z0-9_]{3,25})/i);
  if (twitchM) {
    const handle = twitchM[1].toLowerCase();
    return { meta: { platform: "twitch", handle, url: `https://twitch.tv/${handle}` }, title: `Follow on Twitch — ${handle}` };
  }

  // YouTube channel (@handle or /channel/UC...)
  const ytHandle = raw.match(/youtube\.com\/@([a-zA-Z0-9._-]+)/i);
  if (ytHandle) {
    const handle = ytHandle[1];
    return { meta: { platform: "youtube", handle: `@${handle}`, url: `https://youtube.com/@${handle}` }, title: `Subscribe on YouTube — @${handle}` };
  }

  // TikTok
  const ttM = raw.match(/tiktok\.com\/@([a-zA-Z0-9._]+)/i);
  if (ttM) {
    const handle = ttM[1];
    return { meta: { platform: "tiktok", handle: `@${handle}`, url: `https://tiktok.com/@${handle}` }, title: `Follow on TikTok — @${handle}` };
  }

  // Spotify artist
  const spM = raw.match(/open\.spotify\.com\/artist\/([a-zA-Z0-9]+)/i);
  if (spM) {
    return { meta: { platform: "spotify", handle: spM[1], url: raw }, title: "Follow on Spotify" };
  }

  // Instagram
  const igHandle = extractInstagramHandle(raw);
  if (igHandle) {
    return { meta: { platform: "instagram", handle: `@${igHandle}`, url: `https://instagram.com/${igHandle}` }, title: `Follow on Instagram — @${igHandle}` };
  }

  // Twitter / X
  const twHandle = extractTwitterHandle(raw);
  if (twHandle) {
    return { meta: { platform: "twitter", handle: `@${twHandle}`, url: `https://twitter.com/${twHandle}` }, title: `Follow on Twitter — @${twHandle}` };
  }

  return null;
}
