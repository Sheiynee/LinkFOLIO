import type { BgLayer } from "@/lib/themes";
import { layerStyle } from "@/lib/backgrounds";

/**
 * Renders the stacked background layers as absolutely-positioned children.
 * Caller should make the parent `position: relative` and place its content
 * after (or with higher z-index than) this component.
 */
export function BackgroundLayers({ layers }: { layers: BgLayer[] }) {
  const visible = layers.filter((l) => l.visible !== false);
  if (visible.length === 0) return null;
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
      {visible.map((layer) => (
        <div
          key={layer.id}
          className="absolute inset-0"
          style={layerStyle(layer)}
        />
      ))}
    </div>
  );
}
