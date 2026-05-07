import type { FontId } from "./fonts";

export type ButtonShape = "rounded" | "pill" | "square";
export type ButtonStyle = "glass" | "solid" | "outline" | "shadow";

export interface Theme {
  preset: string;
  bg_from: string;
  bg_to: string;
  bg_image_url?: string | null;
  bg_blur?: number;
  text_color: string;
  muted_color: string;
  accent_color: string;
  button_bg: string;
  button_text: string;
  button_border: string;
  button_shape: ButtonShape;
  button_style: ButtonStyle;
  font: FontId;
}

export const PRESETS: Record<string, Theme & { label: string; description: string }> = {
  glass: {
    preset: "glass",
    label: "Apple Glass",
    description: "Frosted glassmorphism on a deep gradient",
    bg_from: "#1e1b4b",
    bg_to: "#0f172a",
    text_color: "#ffffff",
    muted_color: "#cbd5e1",
    accent_color: "#a855f7",
    button_bg: "rgba(255,255,255,0.08)",
    button_text: "#ffffff",
    button_border: "rgba(255,255,255,0.18)",
    button_shape: "rounded",
    button_style: "glass",
    font: "inter",
  },
  neobrutal: {
    preset: "neobrutal",
    label: "Neobrutal",
    description: "Bold blocks and hard shadows, Gumroad-style",
    bg_from: "#fef3c7",
    bg_to: "#fde68a",
    text_color: "#0a0a0a",
    muted_color: "#525252",
    accent_color: "#dc2626",
    button_bg: "#ffffff",
    button_text: "#0a0a0a",
    button_border: "#0a0a0a",
    button_shape: "square",
    button_style: "shadow",
    font: "space-grotesk",
  },
  mono: {
    preset: "mono",
    label: "Vercel Mono",
    description: "Quiet monochrome, lots of whitespace",
    bg_from: "#fafafa",
    bg_to: "#f4f4f5",
    text_color: "#0a0a0a",
    muted_color: "#71717a",
    accent_color: "#0a0a0a",
    button_bg: "#ffffff",
    button_text: "#0a0a0a",
    button_border: "#e4e4e7",
    button_shape: "rounded",
    button_style: "outline",
    font: "inter",
  },
  retro: {
    preset: "retro",
    label: "Sunset Press",
    description: "Warm gradient with editorial serif",
    bg_from: "#fb923c",
    bg_to: "#ec4899",
    text_color: "#fff7ed",
    muted_color: "#fed7aa",
    accent_color: "#fef3c7",
    button_bg: "rgba(255,255,255,0.15)",
    button_text: "#fff7ed",
    button_border: "rgba(255,255,255,0.3)",
    button_shape: "pill",
    button_style: "glass",
    font: "playfair",
  },
  paper: {
    preset: "paper",
    label: "Notion Paper",
    description: "Soft cream with relaxed serif",
    bg_from: "#fefae0",
    bg_to: "#faedcd",
    text_color: "#3a2e26",
    muted_color: "#78716c",
    accent_color: "#a16207",
    button_bg: "#ffffff",
    button_text: "#3a2e26",
    button_border: "#e7e5e4",
    button_shape: "rounded",
    button_style: "outline",
    font: "lora",
  },
  neon: {
    preset: "neon",
    label: "Linear Neon",
    description: "Pure black with electric accents",
    bg_from: "#000000",
    bg_to: "#0a0a0a",
    text_color: "#ffffff",
    muted_color: "#a1a1aa",
    accent_color: "#22d3ee",
    button_bg: "rgba(34,211,238,0.08)",
    button_text: "#ffffff",
    button_border: "rgba(34,211,238,0.4)",
    button_shape: "rounded",
    button_style: "glass",
    font: "space-grotesk",
  },
};

export const PRESET_LIST = Object.values(PRESETS);

export const DEFAULT_THEME: Theme = PRESETS.glass;

export function normalizeTheme(raw: unknown): Theme {
  if (!raw || typeof raw !== "object") return DEFAULT_THEME;
  const t = raw as Partial<Theme>;
  const presetKey = t.preset && t.preset !== "custom" ? t.preset : null;
  const base = presetKey && PRESETS[presetKey] ? PRESETS[presetKey] : DEFAULT_THEME;
  return {
    ...base,
    ...t,
    preset: t.preset ?? base.preset,
  } as Theme;
}

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
