import type { Element } from "./elements";

export const MOBILE_CANVAS_WIDTH = 360;
export const MOBILE_INSET_X = 16;
export const MOBILE_GAP_Y = 12;
export const MOBILE_INSET_TOP = 220; // matches the desktop header offset

export interface MobilePlacement {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Cache keyed by array identity. State updates always produce a new elements
 * array, so identity is a correct cache key — and the editor calls this many
 * times per pointer-move frame with the same array (placement lookups, snap
 * targets, marquee hit-testing, canvas height).
 */
const placementsCache = new WeakMap<Element[], Record<string, MobilePlacement>>();

/**
 * For an element on the public mobile view: return its mobile placement.
 * If any of `mobile_x/y/w/h` is set the override wins for that axis. Any
 * absent values are filled in by the auto-reflow result.
 *
 * Auto-reflow sorts every element by its desktop `y` and stacks them
 * full-width, preserving each element's desktop height.
 */
export function placementsForMobile(elements: Element[]): Record<string, MobilePlacement> {
  const cached = placementsCache.get(elements);
  if (cached) return cached;
  const sorted = [...elements].sort((a, b) => a.y - b.y);
  const width = MOBILE_CANVAS_WIDTH - MOBILE_INSET_X * 2;
  let y = MOBILE_INSET_TOP;
  const out: Record<string, MobilePlacement> = {};
  for (const e of sorted) {
    const auto: MobilePlacement = {
      x: MOBILE_INSET_X,
      y,
      w: width,
      h: e.h,
    };
    out[e.id] = {
      x: typeof e.mobile_x === "number" ? e.mobile_x : auto.x,
      y: typeof e.mobile_y === "number" ? e.mobile_y : auto.y,
      w: typeof e.mobile_w === "number" ? e.mobile_w : auto.w,
      h: typeof e.mobile_h === "number" ? e.mobile_h : auto.h,
    };
    y += auto.h + MOBILE_GAP_Y;
  }
  placementsCache.set(elements, out);
  return out;
}
