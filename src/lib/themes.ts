import type { FontId } from "./fonts";

export type ButtonShape = "rounded" | "pill" | "square";
export type ButtonStyle = "glass" | "solid" | "outline" | "shadow";

// ── Typography ───────────────────────────────────────────────
export type TypographySource = "google" | "curated" | "user_font";

export interface TypographyRole {
  /** For source=google/curated: a FontId. For user_font: a user_fonts.id (uuid). */
  family: string;
  source: TypographySource;
  weight?: number;
  lineHeight?: number;
  letterSpacing?: number;
}

export interface ThemeTypography {
  display: TypographyRole;
  heading: TypographyRole;
  body: TypographyRole;
  ui: TypographyRole;
  mono: TypographyRole;
}

export type TypographyRoleId = keyof ThemeTypography;
export const TYPOGRAPHY_ROLES: TypographyRoleId[] = ["display", "heading", "body", "ui", "mono"];

// ── Background layers ────────────────────────────────────────
export interface GradientStop {
  color: string;
  /** 0–100 */
  position: number;
}

export interface MeshBlob {
  /** % position 0–100 */
  x: number;
  y: number;
  color: string;
  /** % of container, 20–120 */
  size: number;
  /** px */
  blur: number;
}

export type PatternKind =
  | "dots"
  | "lines_h"
  | "lines_d"
  | "grid"
  | "grid_paper"
  | "topographic"
  | "isometric"
  | "hexagons"
  | "checks"
  | "crosshatch";

export interface BgLayerBase {
  id: string;
  visible?: boolean;
}

export interface GradientLayer extends BgLayerBase {
  type: "gradient";
  stops: GradientStop[];
  /** degrees, 0–360 */
  angle: number;
}

export interface MeshLayer extends BgLayerBase {
  type: "mesh";
  blobs: MeshBlob[];
}

export interface PatternLayer extends BgLayerBase {
  type: "pattern";
  kind: PatternKind;
  color: string;
  /** px tile size, ~8–96 */
  scale: number;
  /** 0–1 */
  opacity: number;
}

export type BackgroundSize = "cover" | "contain";
export type BackgroundBlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "soft-light"
  | "luminosity";

export interface ImageLayer extends BgLayerBase {
  type: "image";
  url: string;
  /** 0–1 */
  opacity: number;
  /** px, 0–60 */
  blur: number;
  size: BackgroundSize;
  blend: BackgroundBlendMode;
}

export type BgLayer = GradientLayer | MeshLayer | PatternLayer | ImageLayer;

export interface ThemeBackground {
  layers: BgLayer[];
}

// ── Theme ────────────────────────────────────────────────────
export interface Theme {
  preset: string;
  background: ThemeBackground;
  text_color: string;
  muted_color: string;
  accent_color: string;
  button_bg: string;
  button_text: string;
  button_border: string;
  button_shape: ButtonShape;
  button_style: ButtonStyle;
  typography: ThemeTypography;
}

// ── Helpers to build defaults ────────────────────────────────
function role(family: FontId | string, source: TypographySource = "google"): TypographyRole {
  return { family, source };
}

function gradient(angle: number, stops: [string, string] | [string, string, string]): GradientLayer {
  const n = stops.length;
  return {
    id: "bg",
    type: "gradient",
    angle,
    stops: stops.map((color, i) => ({ color, position: Math.round((i / (n - 1)) * 100) })),
  };
}

function typo(body: FontId, display?: FontId, mono: FontId = "jetbrains"): ThemeTypography {
  const head = display ?? body;
  return {
    display: role(head),
    heading: role(head),
    body: role(body),
    ui: role(body),
    mono: role(mono),
  };
}

// ── Presets ──────────────────────────────────────────────────
type PresetDef = Theme & { label: string; description: string };

export const PRESETS: Record<string, PresetDef> = {
  glass: {
    preset: "glass",
    label: "Apple Glass",
    description: "Frosted glassmorphism on a deep gradient",
    background: { layers: [gradient(135, ["#1e1b4b", "#0f172a"])] },
    text_color: "#ffffff",
    muted_color: "#cbd5e1",
    accent_color: "#a855f7",
    button_bg: "rgba(255,255,255,0.08)",
    button_text: "#ffffff",
    button_border: "rgba(255,255,255,0.18)",
    button_shape: "rounded",
    button_style: "glass",
    typography: typo("inter"),
  },
  neobrutal: {
    preset: "neobrutal",
    label: "Neobrutal",
    description: "Bold blocks and hard shadows, Gumroad-style",
    background: { layers: [gradient(135, ["#fef3c7", "#fde68a"])] },
    text_color: "#0a0a0a",
    muted_color: "#525252",
    accent_color: "#dc2626",
    button_bg: "#ffffff",
    button_text: "#0a0a0a",
    button_border: "#0a0a0a",
    button_shape: "square",
    button_style: "shadow",
    typography: typo("space-grotesk"),
  },
  mono: {
    preset: "mono",
    label: "Vercel Mono",
    description: "Quiet monochrome, lots of whitespace",
    background: { layers: [gradient(135, ["#fafafa", "#f4f4f5"])] },
    text_color: "#0a0a0a",
    muted_color: "#71717a",
    accent_color: "#0a0a0a",
    button_bg: "#ffffff",
    button_text: "#0a0a0a",
    button_border: "#e4e4e7",
    button_shape: "rounded",
    button_style: "outline",
    typography: typo("inter"),
  },
  retro: {
    preset: "retro",
    label: "Sunset Press",
    description: "Warm gradient with editorial serif",
    background: { layers: [gradient(135, ["#fb923c", "#ec4899"])] },
    text_color: "#fff7ed",
    muted_color: "#fed7aa",
    accent_color: "#fef3c7",
    button_bg: "rgba(255,255,255,0.15)",
    button_text: "#fff7ed",
    button_border: "rgba(255,255,255,0.3)",
    button_shape: "pill",
    button_style: "glass",
    typography: typo("inter", "playfair"),
  },
  paper: {
    preset: "paper",
    label: "Notion Paper",
    description: "Soft cream with relaxed serif",
    background: { layers: [gradient(135, ["#fefae0", "#faedcd"])] },
    text_color: "#3a2e26",
    muted_color: "#78716c",
    accent_color: "#a16207",
    button_bg: "#ffffff",
    button_text: "#3a2e26",
    button_border: "#e7e5e4",
    button_shape: "rounded",
    button_style: "outline",
    typography: typo("lora", "playfair"),
  },
  neon: {
    preset: "neon",
    label: "Linear Neon",
    description: "Pure black with electric accents",
    background: { layers: [gradient(135, ["#000000", "#0a0a0a"])] },
    text_color: "#ffffff",
    muted_color: "#a1a1aa",
    accent_color: "#22d3ee",
    button_bg: "rgba(34,211,238,0.08)",
    button_text: "#ffffff",
    button_border: "rgba(34,211,238,0.4)",
    button_shape: "rounded",
    button_style: "glass",
    typography: typo("space-grotesk"),
  },
};

export const PRESET_LIST = Object.values(PRESETS);
export const DEFAULT_THEME: Theme = PRESETS.glass;

// ── Normalize (handles legacy theme.font + legacy bg_from/bg_to) ──
interface LegacyTheme {
  preset?: string;
  bg_from?: string;
  bg_to?: string;
  bg_image_url?: string | null;
  bg_blur?: number;
  font?: string;
  text_color?: string;
  muted_color?: string;
  accent_color?: string;
  button_bg?: string;
  button_text?: string;
  button_border?: string;
  button_shape?: ButtonShape;
  button_style?: ButtonStyle;
  background?: Partial<ThemeBackground>;
  typography?: Partial<ThemeTypography>;
}

function normalizeTypography(raw: Partial<ThemeTypography> | undefined, legacyFont: string | undefined, fallback: ThemeTypography): ThemeTypography {
  const out: ThemeTypography = { ...fallback };
  // Migrate legacy single font to all roles (except mono — keep curated mono).
  if (legacyFont && !raw) {
    const r = role(legacyFont);
    return {
      display: r,
      heading: r,
      body: r,
      ui: r,
      mono: fallback.mono,
    };
  }
  if (raw) {
    for (const k of TYPOGRAPHY_ROLES) {
      const v = raw[k];
      if (v && typeof v === "object" && typeof v.family === "string") {
        out[k] = {
          family: v.family,
          source: v.source === "user_font" ? "user_font" : v.source === "curated" ? "curated" : "google",
          weight: typeof v.weight === "number" ? v.weight : undefined,
          lineHeight: typeof v.lineHeight === "number" ? v.lineHeight : undefined,
          letterSpacing: typeof v.letterSpacing === "number" ? v.letterSpacing : undefined,
        };
      }
    }
  }
  return out;
}

function normalizeBackground(raw: Partial<ThemeBackground> | undefined, legacy: LegacyTheme, fallback: ThemeBackground): ThemeBackground {
  if (raw && Array.isArray(raw.layers) && raw.layers.length > 0) {
    const layers: BgLayer[] = [];
    for (const l of raw.layers) {
      if (!l || typeof l !== "object") continue;
      const id = typeof (l as BgLayerBase).id === "string" ? (l as BgLayerBase).id : crypto.randomUUID();
      const visible = (l as BgLayerBase).visible !== false;
      if ((l as BgLayer).type === "gradient") {
        const g = l as Partial<GradientLayer>;
        if (Array.isArray(g.stops) && g.stops.length >= 2) {
          layers.push({ id, visible, type: "gradient", angle: typeof g.angle === "number" ? g.angle : 135, stops: g.stops.map((s) => ({ color: String(s.color), position: Math.max(0, Math.min(100, Number(s.position) || 0)) })) });
        }
      } else if ((l as BgLayer).type === "mesh") {
        const m = l as Partial<MeshLayer>;
        if (Array.isArray(m.blobs)) {
          layers.push({ id, visible, type: "mesh", blobs: m.blobs.map((b) => ({ x: Number(b.x) || 50, y: Number(b.y) || 50, color: String(b.color), size: Number(b.size) || 60, blur: Number(b.blur) || 40 })) });
        }
      } else if ((l as BgLayer).type === "pattern") {
        const p = l as Partial<PatternLayer>;
        layers.push({ id, visible, type: "pattern", kind: (p.kind ?? "dots") as PatternKind, color: String(p.color ?? "#ffffff"), scale: Number(p.scale) || 24, opacity: Number(p.opacity) || 0.15 });
      } else if ((l as BgLayer).type === "image") {
        const im = l as Partial<ImageLayer>;
        if (typeof im.url === "string" && im.url.length > 0) {
          const size: BackgroundSize = im.size === "contain" ? "contain" : "cover";
          const blend: BackgroundBlendMode = (["normal", "multiply", "screen", "overlay", "soft-light", "luminosity"] as BackgroundBlendMode[]).includes(im.blend as BackgroundBlendMode)
            ? (im.blend as BackgroundBlendMode)
            : "normal";
          layers.push({
            id, visible, type: "image",
            url: im.url,
            opacity: typeof im.opacity === "number" ? Math.max(0, Math.min(1, im.opacity)) : 1,
            blur: typeof im.blur === "number" ? Math.max(0, Math.min(60, im.blur)) : 0,
            size,
            blend,
          });
        }
      }
    }
    if (layers.length > 0) return { layers };
  }
  // Migrate legacy bg_from/bg_to.
  if (legacy.bg_from && legacy.bg_to) {
    return { layers: [gradient(135, [legacy.bg_from, legacy.bg_to])] };
  }
  return fallback;
}

export function normalizeTheme(raw: unknown): Theme {
  if (!raw || typeof raw !== "object") return DEFAULT_THEME;
  const t = raw as LegacyTheme;
  const presetKey = t.preset && t.preset !== "custom" ? t.preset : null;
  const base = presetKey && PRESETS[presetKey] ? PRESETS[presetKey] : DEFAULT_THEME;
  return {
    preset: t.preset ?? base.preset,
    background: normalizeBackground(t.background, t, base.background),
    text_color: t.text_color ?? base.text_color,
    muted_color: t.muted_color ?? base.muted_color,
    accent_color: t.accent_color ?? base.accent_color,
    button_bg: t.button_bg ?? base.button_bg,
    button_text: t.button_text ?? base.button_text,
    button_border: t.button_border ?? base.button_border,
    button_shape: t.button_shape ?? base.button_shape,
    button_style: t.button_style ?? base.button_style,
    typography: normalizeTypography(t.typography, t.font, base.typography),
  };
}

// ── Button helpers (unchanged) ───────────────────────────────
export function buttonRadiusClass(shape: ButtonShape): string {
  switch (shape) {
    case "pill": return "rounded-full";
    case "square": return "rounded-none";
    default: return "rounded-xl";
  }
}

export function buttonExtraStyle(style: ButtonStyle): React.CSSProperties {
  switch (style) {
    case "glass": return { backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" };
    case "shadow": return { boxShadow: "4px 4px 0 0 currentColor" };
    default: return {};
  }
}

// ── Layer factories (used by editor + onboarding) ────────────
export function newGradientLayer(angle = 135, stops: GradientStop[] = [
  { color: "#7c3aed", position: 0 },
  { color: "#0f172a", position: 100 },
]): GradientLayer {
  return { id: crypto.randomUUID(), type: "gradient", angle, stops };
}

export function newMeshLayer(): MeshLayer {
  return {
    id: crypto.randomUUID(),
    type: "mesh",
    blobs: [
      { x: 20, y: 20, color: "#7c3aed", size: 70, blur: 80 },
      { x: 80, y: 70, color: "#ec4899", size: 60, blur: 80 },
    ],
  };
}

export function newPatternLayer(kind: PatternKind = "dots"): PatternLayer {
  return { id: crypto.randomUUID(), type: "pattern", kind, color: "#ffffff", scale: 24, opacity: 0.12 };
}

export function newImageLayer(url: string): ImageLayer {
  return {
    id: crypto.randomUUID(),
    type: "image",
    url,
    opacity: 1,
    blur: 0,
    size: "cover",
    blend: "normal",
  };
}
