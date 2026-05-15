import type { Theme, ThemeBackground } from "./themes";

interface HSL {
  h: number;
  s: number;
  l: number;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgbToHsl([r, g, b]: [number, number, number]): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)); break;
      case gn: h = ((bn - rn) / d + 2); break;
      case bn: h = ((rn - gn) / d + 4); break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex({ h, s, l }: HSL): string {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to255 = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to255(r)}${to255(g)}${to255(b)}`;
}

function adjust(hsl: HSL, dh = 0, ds = 0, dl = 0): HSL {
  return {
    h: (hsl.h + dh + 360) % 360,
    s: clamp(hsl.s + ds, 0, 100),
    l: clamp(hsl.l + dl, 0, 100),
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

interface PaletteResult {
  background: ThemeBackground;
  text_color: Theme["text_color"];
  muted_color: Theme["muted_color"];
  accent_color: Theme["accent_color"];
  button_bg: Theme["button_bg"];
  button_text: Theme["button_text"];
  button_border: Theme["button_border"];
}

export function paletteFromSeed(seedHex: string): PaletteResult {
  const rgb = hexToRgb(seedHex);
  if (!rgb) {
    return {
      background: {
        layers: [{
          id: crypto.randomUUID(),
          type: "gradient",
          angle: 135,
          stops: [
            { color: "#1e1b4b", position: 0 },
            { color: "#0f172a", position: 100 },
          ],
        }],
      },
      text_color: "#ffffff",
      muted_color: "#cbd5e1",
      accent_color: seedHex,
      button_bg: "rgba(255,255,255,0.08)",
      button_text: "#ffffff",
      button_border: "rgba(255,255,255,0.18)",
    };
  }

  const seed = rgbToHsl(rgb);
  const isDarkSeed = seed.l < 50;

  const bgFrom = hslToHex(adjust(seed, -8, -10, isDarkSeed ? -25 : -55));
  const bgTo = hslToHex(adjust(seed, 8, -15, isDarkSeed ? -40 : -65));

  const text = "#ffffff";
  const muted = hslToHex(adjust(seed, 0, -30, 30));

  const accent = hslToHex(adjust(seed, 12, 15, 5));

  return {
    background: {
      layers: [{
        id: crypto.randomUUID(),
        type: "gradient",
        angle: 135,
        stops: [
          { color: bgFrom, position: 0 },
          { color: bgTo, position: 100 },
        ],
      }],
    },
    text_color: text,
    muted_color: muted,
    accent_color: accent,
    button_bg: "rgba(255,255,255,0.08)",
    button_text: "#ffffff",
    button_border: "rgba(255,255,255,0.18)",
  };
}
