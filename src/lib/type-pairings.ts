import type { FontId } from "./fonts";
import type { ThemeTypography, TypographyRole } from "./themes";

export interface TypePairing {
  id: string;
  label: string;
  description: string;
  /** Font shown in the preview tile in onboarding. */
  previewFont: FontId;
  /** Full 5-role assignment applied when the pairing is picked. */
  roles: ThemeTypography;
}

const g = (family: FontId): TypographyRole => ({ family, source: "google" });

export const TYPE_PAIRINGS: TypePairing[] = [
  {
    id: "editorial",
    label: "Editorial",
    description: "Playfair headlines + Inter body. Magazine feel.",
    previewFont: "playfair",
    roles: {
      display: g("playfair"),
      heading: g("playfair"),
      body: g("inter"),
      ui: g("inter"),
      mono: g("jetbrains"),
    },
  },
  {
    id: "tech",
    label: "Tech",
    description: "Space Grotesk throughout — modern, geometric.",
    previewFont: "space-grotesk",
    roles: {
      display: g("space-grotesk"),
      heading: g("space-grotesk"),
      body: g("space-grotesk"),
      ui: g("space-grotesk"),
      mono: g("jetbrains"),
    },
  },
  {
    id: "modernist",
    label: "Modernist",
    description: "Inter everywhere. Familiar, trustworthy, dense.",
    previewFont: "inter",
    roles: {
      display: g("inter"),
      heading: g("inter"),
      body: g("inter"),
      ui: g("inter"),
      mono: g("jetbrains"),
    },
  },
  {
    id: "soft",
    label: "Soft",
    description: "Outfit — rounded, friendly, approachable.",
    previewFont: "outfit",
    roles: {
      display: g("outfit"),
      heading: g("outfit"),
      body: g("outfit"),
      ui: g("outfit"),
      mono: g("jetbrains"),
    },
  },
  {
    id: "serif_classic",
    label: "Serif Classic",
    description: "Lora — warm reading serif. Literary.",
    previewFont: "lora",
    roles: {
      display: g("lora"),
      heading: g("lora"),
      body: g("lora"),
      ui: g("inter"),
      mono: g("jetbrains"),
    },
  },
  {
    id: "mono_forward",
    label: "Mono Forward",
    description: "JetBrains Mono — terminal-coded, devlog energy.",
    previewFont: "jetbrains",
    roles: {
      display: g("jetbrains"),
      heading: g("jetbrains"),
      body: g("jetbrains"),
      ui: g("jetbrains"),
      mono: g("jetbrains"),
    },
  },
  {
    id: "display_wide",
    label: "Display Wide",
    description: "Bebas headlines + Inter body. Tall, shouting.",
    previewFont: "bebas",
    roles: {
      display: g("bebas"),
      heading: g("bebas"),
      body: g("inter"),
      ui: g("inter"),
      mono: g("jetbrains"),
    },
  },
  {
    id: "handwritten",
    label: "Handwritten",
    description: "Caveat display + Inter body. Personal, casual.",
    previewFont: "caveat",
    roles: {
      display: g("caveat"),
      heading: g("caveat"),
      body: g("inter"),
      ui: g("inter"),
      mono: g("jetbrains"),
    },
  },
  {
    id: "brutalist",
    label: "Brutalist",
    description: "Space Grotesk display + Inter body. Raw, opinionated.",
    previewFont: "space-grotesk",
    roles: {
      display: g("space-grotesk"),
      heading: g("space-grotesk"),
      body: g("inter"),
      ui: g("inter"),
      mono: g("jetbrains"),
    },
  },
  {
    id: "magazine",
    label: "Magazine",
    description: "Playfair lead, Lora body. Editorial cousin.",
    previewFont: "playfair",
    roles: {
      display: g("playfair"),
      heading: g("playfair"),
      body: g("lora"),
      ui: g("inter"),
      mono: g("jetbrains"),
    },
  },
  {
    id: "y2k",
    label: "Y2K",
    description: "Outfit — high optical size, retro-modern bounce.",
    previewFont: "outfit",
    roles: {
      display: g("bebas"),
      heading: g("outfit"),
      body: g("outfit"),
      ui: g("outfit"),
      mono: g("jetbrains"),
    },
  },
  {
    id: "playful",
    label: "Playful",
    description: "Caveat — handwritten energy without all the edges.",
    previewFont: "caveat",
    roles: {
      display: g("caveat"),
      heading: g("outfit"),
      body: g("outfit"),
      ui: g("outfit"),
      mono: g("jetbrains"),
    },
  },
];

export function getTypePairing(id: string): TypePairing | undefined {
  return TYPE_PAIRINGS.find((p) => p.id === id);
}
