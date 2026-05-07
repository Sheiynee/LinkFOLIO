import {
  Inter,
  Space_Grotesk,
  Playfair_Display,
  Lora,
  JetBrains_Mono,
  Caveat,
  Bebas_Neue,
  Outfit,
} from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" });
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-bebas", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });

export const fontVariables = [
  inter.variable,
  spaceGrotesk.variable,
  playfair.variable,
  lora.variable,
  jetbrains.variable,
  caveat.variable,
  bebas.variable,
  outfit.variable,
].join(" ");

export const FONTS = [
  { id: "inter", label: "Inter", cssVar: "var(--font-inter)", sampleClass: "font-[var(--font-inter)]" },
  { id: "space-grotesk", label: "Space Grotesk", cssVar: "var(--font-space-grotesk)", sampleClass: "font-[var(--font-space-grotesk)]" },
  { id: "outfit", label: "Outfit", cssVar: "var(--font-outfit)", sampleClass: "font-[var(--font-outfit)]" },
  { id: "playfair", label: "Playfair Display", cssVar: "var(--font-playfair)", sampleClass: "font-[var(--font-playfair)]" },
  { id: "lora", label: "Lora", cssVar: "var(--font-lora)", sampleClass: "font-[var(--font-lora)]" },
  { id: "jetbrains", label: "JetBrains Mono", cssVar: "var(--font-jetbrains)", sampleClass: "font-[var(--font-jetbrains)]" },
  { id: "caveat", label: "Caveat", cssVar: "var(--font-caveat)", sampleClass: "font-[var(--font-caveat)]" },
  { id: "bebas", label: "Bebas Neue", cssVar: "var(--font-bebas)", sampleClass: "font-[var(--font-bebas)]" },
] as const;

export type FontId = (typeof FONTS)[number]["id"];

export function fontVarFor(id: string | undefined | null): string {
  return FONTS.find((f) => f.id === id)?.cssVar ?? "var(--font-sans)";
}
