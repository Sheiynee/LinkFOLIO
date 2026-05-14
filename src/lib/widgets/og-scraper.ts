import "server-only";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { OgCardData } from "./types";

const MAX_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 5000;
const USER_AGENT = "LinkFolioBot/1.0 (+https://linkfolio.app)";

const PRIVATE_CIDR_PREFIXES = [
  "0.", // 0.0.0.0/8
  "10.", // 10.0.0.0/8
  "127.", // loopback
  "169.254.", // link-local
  "192.168.", // private
  "::1", // IPv6 loopback
  "fc", // IPv6 unique-local (fc00::/7) — fc and fd
  "fd",
  "fe80", // IPv6 link-local
];

function isPrivateIp(ip: string): boolean {
  if (ip.startsWith("172.")) {
    const second = parseInt(ip.split(".")[1] ?? "0", 10);
    if (second >= 16 && second <= 31) return true;
  }
  return PRIVATE_CIDR_PREFIXES.some((prefix) => ip.toLowerCase().startsWith(prefix));
}

async function isPublicUrl(rawUrl: string): Promise<URL | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();
  if (!host) return null;
  if (host === "localhost" || host === "metadata.google.internal") return null;

  // If host is already an IP, check directly.
  if (isIP(host)) {
    if (isPrivateIp(host)) return null;
    return url;
  }

  // Resolve via DNS — reject any A/AAAA that points into private space.
  try {
    const records = await dnsLookup(host, { all: true });
    for (const rec of records) {
      if (isPrivateIp(rec.address)) return null;
    }
  } catch {
    return null;
  }

  return url;
}

async function fetchHtmlBytes(url: URL): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
      next: { revalidate: 60 * 60 * 24, tags: ["og"] },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) return null;

    const reader = res.body?.getReader();
    if (!reader) return null;

    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.byteLength;
        if (received > MAX_BYTES) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pickMeta(html: string, names: string[]): string | null {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)\\s*=\\s*["']${escape(name)}["'][^>]*?content\\s*=\\s*["']([^"']+)["']`,
      "i"
    );
    const m = html.match(re);
    if (m) return decodeEntities(m[1]);
    const reReverse = new RegExp(
      `<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]*?(?:property|name)\\s*=\\s*["']${escape(name)}["']`,
      "i"
    );
    const m2 = html.match(reReverse);
    if (m2) return decodeEntities(m2[1]);
  }
  return null;
}

function pickTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? decodeEntities(m[1].trim()) : null;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function resolveImageUrl(image: string | null, base: URL): string | null {
  if (!image) return null;
  try {
    return new URL(image, base).toString();
  } catch {
    return null;
  }
}

export async function fetchOgCard(rawUrl: string): Promise<OgCardData | null> {
  const url = await isPublicUrl(rawUrl);
  if (!url) return null;

  const html = await fetchHtmlBytes(url);
  if (!html) {
    // Even without metadata we can return the URL so the card renders something.
    return { title: null, description: null, image_url: null, site_name: null, url: url.toString() };
  }

  const title =
    pickMeta(html, ["og:title", "twitter:title"]) ?? pickTitle(html);
  const description =
    pickMeta(html, ["og:description", "twitter:description", "description"]);
  const image = pickMeta(html, ["og:image", "og:image:url", "twitter:image", "twitter:image:src"]);
  const siteName = pickMeta(html, ["og:site_name"]);

  return {
    title,
    description,
    image_url: resolveImageUrl(image, url),
    site_name: siteName ?? url.hostname.replace(/^www\./, ""),
    url: url.toString(),
  };
}

export function isProbablyValidUrl(input: string): boolean {
  try {
    const u = new URL(input);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
