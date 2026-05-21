import type { BgLayer } from "./themes";

/**
 * Per-type schemas for canvas-only visual elements (shape / sticker / image /
 * region). Their config lives in `elements.meta` (jsonb) — these helpers
 * normalize what came back from the DB into typed structures and expose the
 * picker presets the editor uses.
 */

// ── Shapes ────────────────────────────────────────────────
export type ShapeKind = "rect" | "circle" | "blob" | "triangle";

export interface ShapeMeta {
  kind: ShapeKind;
  fill: string;
  stroke: string | null;
  strokeWidth: number;
  /** Corner radius (% of the shorter side) for rect. */
  radius: number;
  /** Deterministic seed for the blob path so saves look identical to previews. */
  seed: number;
}

const DEFAULT_SHAPE_FILL = "#6366f1"; // indigo-500

export function defaultShapeMeta(kind: ShapeKind): ShapeMeta {
  return {
    kind,
    fill: DEFAULT_SHAPE_FILL,
    stroke: null,
    strokeWidth: 0,
    radius: kind === "rect" ? 12 : 0,
    seed: Math.floor(Math.random() * 1_000_000),
  };
}

export function readShapeMeta(meta: Record<string, unknown> | null | undefined): ShapeMeta {
  const m = meta ?? {};
  const kind = readShapeKind(m.kind) ?? "rect";
  return {
    kind,
    fill: readHexColor(m.fill) ?? DEFAULT_SHAPE_FILL,
    stroke: readHexColor(m.stroke) ?? null,
    strokeWidth: clamp(readNumber(m.strokeWidth) ?? 0, 0, 24),
    radius: clamp(readNumber(m.radius) ?? (kind === "rect" ? 12 : 0), 0, 100),
    seed: readNumber(m.seed) ?? 0,
  };
}

function readShapeKind(v: unknown): ShapeKind | null {
  return v === "rect" || v === "circle" || v === "blob" || v === "triangle" ? v : null;
}

/**
 * Deterministic blob SVG path. Returns a `d` attribute string normalized to a
 * 100×100 viewBox. The path is built from N points equally spaced around a
 * circle, with each radius perturbed by a hash of `seed + i`.
 */
export function blobPath(seed: number, points = 7): string {
  const cx = 50;
  const cy = 50;
  const baseR = 40;
  const wobble = 12;
  const coords: Array<[number, number]> = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const noise = (mulberry32(seed + i)() - 0.5) * wobble * 2;
    const r = baseR + noise;
    coords.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }
  // Smooth cubic curve through the points (Catmull-Rom-ish).
  const closed = [...coords, coords[0], coords[1]];
  const segs: string[] = [`M ${coords[0][0].toFixed(2)} ${coords[0][1].toFixed(2)}`];
  for (let i = 0; i < coords.length; i++) {
    const p0 = closed[i];
    const p1 = closed[i + 1];
    const p2 = closed[(i + 2) % closed.length];
    const c1x = p0[0] + (p1[0] - closed[(i - 1 + closed.length) % closed.length][0]) / 6;
    const c1y = p0[1] + (p1[1] - closed[(i - 1 + closed.length) % closed.length][1]) / 6;
    const c2x = p1[0] - (p2[0] - p0[0]) / 6;
    const c2y = p1[1] - (p2[1] - p0[1]) / 6;
    segs.push(`C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`);
  }
  segs.push("Z");
  return segs.join(" ");
}

/** Tiny seedable PRNG so blob paths match between server and client renders. */
function mulberry32(seed: number) {
  let a = (seed | 0) || 1;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Canvas buttons (link element styling) ────────────────
export type ButtonVariant = "solid" | "outline" | "ghost" | "pill";
export const BUTTON_VARIANTS: ButtonVariant[] = ["solid", "outline", "ghost", "pill"];

/** Icons curated for prefixing canvas buttons. */
export const BUTTON_ICONS = [
  "ArrowRight", "ExternalLink", "Download", "Mail",
  "Twitch", "Youtube", "Github", "Twitter",
  "Music", "Heart", "Star", "Send",
] as const;
export type ButtonIcon = (typeof BUTTON_ICONS)[number];

export interface ButtonMeta {
  variant: ButtonVariant;
  icon: ButtonIcon | null;
}

export function readButtonMeta(meta: Record<string, unknown> | null | undefined): ButtonMeta {
  const m = meta ?? {};
  const variant = BUTTON_VARIANTS.includes(m.variant as ButtonVariant)
    ? (m.variant as ButtonVariant)
    : "solid";
  const icon = BUTTON_ICONS.includes(m.icon as ButtonIcon) ? (m.icon as ButtonIcon) : null;
  return { variant, icon };
}

// ── Stickers ─────────────────────────────────────────────
/**
 * Curated sticker set — lucide icon names. Lucide is already a dependency, so
 * we don't need to host glyphs ourselves. Keep the list short; this is a
 * fingertip-feel pack, not a search-an-icon-library experience.
 */
export const STICKER_ICONS = [
  "Star", "Heart", "Sparkles", "Flame", "Zap", "Sun", "Moon", "Cloud",
  "Music", "Gamepad2", "Camera", "Mic", "Headphones", "Tv",
  "ThumbsUp", "PartyPopper", "Trophy", "Crown", "Gem", "Rocket",
  "Smile", "Eye", "Coffee", "Pizza",
] as const;
export type StickerIcon = (typeof STICKER_ICONS)[number];

export interface StickerMeta {
  icon: StickerIcon;
  color: string;
}

const DEFAULT_STICKER_COLOR = "#f59e0b"; // amber-500

export function defaultStickerMeta(icon: StickerIcon = "Sparkles"): StickerMeta {
  return { icon, color: DEFAULT_STICKER_COLOR };
}

export function readStickerMeta(meta: Record<string, unknown> | null | undefined): StickerMeta {
  const m = meta ?? {};
  const icon = STICKER_ICONS.includes(m.icon as StickerIcon)
    ? (m.icon as StickerIcon)
    : "Sparkles";
  return { icon, color: readHexColor(m.color) ?? DEFAULT_STICKER_COLOR };
}

// ── Images ───────────────────────────────────────────────
export type ImageMask = "none" | "circle" | "rounded" | "blob" | "hexagon" | "triangle";

export const IMAGE_MASKS: ImageMask[] = ["none", "circle", "rounded", "blob", "hexagon", "triangle"];

export interface ImageMeta {
  url: string;
  storage_path: string | null;
  mask: ImageMask;
  fit: "cover" | "contain";
  blur: number;
}

export function defaultImageMeta(url: string, storage_path: string | null = null): ImageMeta {
  return { url, storage_path, mask: "none", fit: "cover", blur: 0 };
}

export function readImageMeta(meta: Record<string, unknown> | null | undefined): ImageMeta | null {
  const m = meta ?? {};
  const url = typeof m.url === "string" ? m.url : null;
  if (!url) return null;
  const mask = IMAGE_MASKS.includes(m.mask as ImageMask) ? (m.mask as ImageMask) : "none";
  const fit = m.fit === "contain" ? "contain" : "cover";
  return {
    url,
    storage_path: typeof m.storage_path === "string" ? m.storage_path : null,
    mask,
    fit,
    blur: clamp(readNumber(m.blur) ?? 0, 0, 60),
  };
}

/** CSS `clip-path` value for the requested mask (or null = no clip). */
export function imageMaskClipPath(mask: ImageMask, blobSeed = 1): string | null {
  switch (mask) {
    case "none": return null;
    case "rounded": return null; // handled via border-radius instead
    case "circle": return "circle(50% at 50% 50%)";
    case "hexagon":
      return "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)";
    case "triangle":
      return "polygon(50% 0%, 100% 100%, 0% 100%)";
    case "blob": {
      // Sample the same blob path at 8 evenly-spaced angles to build a
      // clip-path polygon. The result is deterministic per seed.
      const points = 12;
      const cx = 50, cy = 50, baseR = 45, wobble = 8;
      const coords: string[] = [];
      for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const noise = (mulberry32(blobSeed + i)() - 0.5) * wobble * 2;
        const r = baseR + noise;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        coords.push(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
      }
      return `polygon(${coords.join(", ")})`;
    }
  }
}

// ── Regions (per-section backgrounds) ────────────────────
export interface RegionMeta {
  layers: BgLayer[];
  /** Border-radius in px applied to the region box. */
  radius: number;
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `bg-${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultRegionMeta(): RegionMeta {
  return {
    layers: [
      {
        id: newId(),
        visible: true,
        type: "gradient",
        angle: 135,
        stops: [
          { color: "#6366f1", position: 0 },
          { color: "#a855f7", position: 100 },
        ],
      },
    ],
    radius: 24,
  };
}

export function readRegionMeta(meta: Record<string, unknown> | null | undefined): RegionMeta {
  const m = meta ?? {};
  const layers = Array.isArray(m.layers) ? (m.layers as BgLayer[]) : [];
  return {
    layers,
    radius: clamp(readNumber(m.radius) ?? 24, 0, 200),
  };
}

// ── Utilities ────────────────────────────────────────────
function readHexColor(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return /^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{8}$/.test(v) ? v : null;
}

function readNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
