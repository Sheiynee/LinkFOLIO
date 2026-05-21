import type { BgLayer } from "@/lib/themes";
import { layerStyle } from "@/lib/backgrounds";
import { AnimatedBackgroundLayer } from "./animated-background-layer";

/**
 * Renders the stacked background layers as absolutely-positioned children.
 * Caller should make the parent `position: relative` and place its content
 * after (or with higher z-index than) this component.
 *
 * Animated and video layers can't be rendered with pure CSS so they delegate
 * to dedicated client components (lazy-loaded via dynamic-friendly imports).
 */
export function BackgroundLayers({ layers }: { layers: BgLayer[] }) {
  const visible = layers.filter((l) => l.visible !== false);
  if (visible.length === 0) return null;
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
      {visible.map((layer) => {
        if (layer.type === "animated") {
          return <AnimatedBackgroundLayer key={layer.id} layer={layer} />;
        }
        if (layer.type === "video") {
          return (
            <video
              key={layer.id}
              src={layer.url}
              poster={layer.poster ?? undefined}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: layer.opacity }}
            />
          );
        }
        return (
          <div
            key={layer.id}
            className="absolute inset-0"
            style={layerStyle(layer)}
          />
        );
      })}
    </div>
  );
}
