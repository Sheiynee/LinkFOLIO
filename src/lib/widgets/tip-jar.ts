import type { TipPlatform } from "./types";

export interface TipPlatformInfo {
  id: TipPlatform;
  label: string;
  hostPattern: RegExp;
  buildUrl: (handle: string) => string;
  brand: string;
  emoji: string;
}

export const TIP_PLATFORMS: Record<TipPlatform, TipPlatformInfo> = {
  kofi: {
    id: "kofi",
    label: "Ko-fi",
    hostPattern: /ko-fi\.com\/([a-zA-Z0-9_-]{1,40})/i,
    buildUrl: (h) => `https://ko-fi.com/${h}`,
    brand: "#13c3ff",
    emoji: "☕",
  },
  bmac: {
    id: "bmac",
    label: "Buy Me a Coffee",
    hostPattern: /buymeacoffee\.com\/([a-zA-Z0-9_-]{1,40})/i,
    buildUrl: (h) => `https://buymeacoffee.com/${h}`,
    brand: "#FFDD00",
    emoji: "☕",
  },
  patreon: {
    id: "patreon",
    label: "Patreon",
    hostPattern: /patreon\.com\/([a-zA-Z0-9_-]{1,40})/i,
    buildUrl: (h) => `https://patreon.com/${h}`,
    brand: "#ff424d",
    emoji: "♥",
  },
  streamlabs: {
    id: "streamlabs",
    label: "Streamlabs",
    hostPattern: /streamlabs\.com\/([a-zA-Z0-9_-]{1,40})/i,
    buildUrl: (h) => `https://streamlabs.com/${h}`,
    brand: "#80f5d2",
    emoji: "✦",
  },
};

export function parseTipJarUrl(input: string): { platform: TipPlatform; handle: string } | null {
  for (const platform of Object.values(TIP_PLATFORMS)) {
    const m = input.match(platform.hostPattern);
    if (m) return { platform: platform.id, handle: m[1] };
  }
  return null;
}
