import type { Theme } from "./themes";
import { gradientCss } from "./backgrounds";

/**
 * Collapses a theme's layered background to a single CSS `background` value
 * suitable for Satori / ImageResponse (no blur filters, no video, no animated
 * layers). Falls back to a dark navy if no renderable layer is found.
 */
export function ogBackground(theme: Theme): string {
  for (const layer of theme.background.layers) {
    if (layer.visible === false) continue;
    if (layer.type === "gradient") return gradientCss(layer);
    if (layer.type === "image") return `url(${layer.url})`;
    if (layer.type === "mesh" && layer.blobs[0]) return layer.blobs[0].color;
    if (layer.type === "pattern") return layer.color;
  }
  return "#0f172a";
}
