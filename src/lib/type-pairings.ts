import type { FontId } from "./fonts";

export interface TypePairing {
  id: string;
  label: string;
  description: string;
  // For the current single-font theme model we just pick one body font;
  // the description hints at the heading family that pairs with it.
  font: FontId;
}

export const TYPE_PAIRINGS: TypePairing[] = [
  { id: "editorial", label: "Editorial", description: "Playfair headlines + clean body. Magazine feel.", font: "playfair" },
  { id: "tech", label: "Tech", description: "Space Grotesk — modern, technical, slightly geometric.", font: "space-grotesk" },
  { id: "modernist", label: "Modernist", description: "Inter everywhere. Familiar, trustworthy, dense.", font: "inter" },
  { id: "soft", label: "Soft", description: "Outfit — rounded, friendly, approachable.", font: "outfit" },
  { id: "serif_classic", label: "Serif Classic", description: "Lora — warm reading serif. Literary.", font: "lora" },
  { id: "mono_forward", label: "Mono Forward", description: "JetBrains Mono — terminal-coded, devlog energy.", font: "jetbrains" },
  { id: "display_wide", label: "Display Wide", description: "Bebas Neue — tall, narrow, headline-shouting.", font: "bebas" },
  { id: "handwritten", label: "Handwritten", description: "Caveat — script feel, personal, casual.", font: "caveat" },
  { id: "brutalist", label: "Brutalist", description: "Space Grotesk pushed loud. Raw, opinionated.", font: "space-grotesk" },
  { id: "magazine", label: "Magazine", description: "Playfair lead, Lora body. Editorial cousin.", font: "lora" },
  { id: "y2k", label: "Y2K", description: "Outfit — high optical size, retro-modern bounce.", font: "outfit" },
  { id: "playful", label: "Playful", description: "Caveat — handwritten energy without all the edges.", font: "caveat" },
];

export function pairingByFont(id: FontId): TypePairing | undefined {
  return TYPE_PAIRINGS.find((p) => p.font === id);
}
