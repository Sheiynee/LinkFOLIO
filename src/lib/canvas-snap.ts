import type { Element } from "./elements";
import { CANVAS_WIDTH } from "./elements";

export const GRID_SIZE = 8;
export const GUIDE_THRESHOLD = 6;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SnapGuide {
  /** 'v' for vertical guide (constant x), 'h' for horizontal (constant y). */
  axis: "v" | "h";
  position: number;
}

export interface SnapResult {
  box: Box;
  guides: SnapGuide[];
}

/** Round a value to the nearest grid multiple. */
export function snapToGrid(v: number): number {
  return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

/**
 * Build candidate snap positions from the canvas and from every other
 * element. For each axis we collect the element's left/center/right (or
 * top/middle/bottom) coordinates as snap targets.
 */
function candidates(others: Element[]) {
  const vert: number[] = [0, CANVAS_WIDTH / 2, CANVAS_WIDTH];
  const horiz: number[] = []; // No fixed canvas height (it grows).
  for (const e of others) {
    vert.push(e.x, e.x + e.w / 2, e.x + e.w);
    horiz.push(e.y, e.y + e.h / 2, e.y + e.h);
  }
  return { vert, horiz };
}

/**
 * Try to snap a moving box to grid AND nearby edges of other elements.
 * Edge snaps take precedence over grid (they show a guide line).
 *
 * `mode` controls which edges of the moving box are considered for
 * snapping: 'move' uses all 6 (L/C/R, T/M/B); 'resize-*' modes only
 * snap the edges being dragged.
 */
export function snap(
  box: Box,
  others: Element[],
  mode: "move" | "resize-l" | "resize-r" | "resize-t" | "resize-b" | "resize-tl" | "resize-tr" | "resize-bl" | "resize-br" = "move"
): SnapResult {
  const { vert, horiz } = candidates(others);
  const guides: SnapGuide[] = [];
  let { x, y, w, h } = box;

  const vEdges: { value: number; apply: (delta: number) => void }[] = [];
  const hEdges: { value: number; apply: (delta: number) => void }[] = [];

  // Which horizontal edges (constant x) does this operation actually move?
  if (mode === "move") {
    vEdges.push(
      { value: x, apply: (d) => { x += d; } },
      { value: x + w / 2, apply: (d) => { x += d; } },
      { value: x + w, apply: (d) => { x += d; } }
    );
  }
  if (mode === "resize-l" || mode === "resize-tl" || mode === "resize-bl") {
    vEdges.push({ value: x, apply: (d) => { x += d; w -= d; } });
  }
  if (mode === "resize-r" || mode === "resize-tr" || mode === "resize-br") {
    vEdges.push({ value: x + w, apply: (d) => { w += d; } });
  }

  if (mode === "move") {
    hEdges.push(
      { value: y, apply: (d) => { y += d; } },
      { value: y + h / 2, apply: (d) => { y += d; } },
      { value: y + h, apply: (d) => { y += d; } }
    );
  }
  if (mode === "resize-t" || mode === "resize-tl" || mode === "resize-tr") {
    hEdges.push({ value: y, apply: (d) => { y += d; h -= d; } });
  }
  if (mode === "resize-b" || mode === "resize-bl" || mode === "resize-br") {
    hEdges.push({ value: y + h, apply: (d) => { h += d; } });
  }

  // Find closest candidate within threshold for each edge.
  for (const edge of vEdges) {
    let best: { pos: number; dist: number } | null = null;
    for (const c of vert) {
      const d = Math.abs(edge.value - c);
      if (d <= GUIDE_THRESHOLD && (best === null || d < best.dist)) {
        best = { pos: c, dist: d };
      }
    }
    if (best) {
      edge.apply(best.pos - edge.value);
      guides.push({ axis: "v", position: best.pos });
      break; // Only one vertical guide at a time.
    }
  }
  for (const edge of hEdges) {
    let best: { pos: number; dist: number } | null = null;
    for (const c of horiz) {
      const d = Math.abs(edge.value - c);
      if (d <= GUIDE_THRESHOLD && (best === null || d < best.dist)) {
        best = { pos: c, dist: d };
      }
    }
    if (best) {
      edge.apply(best.pos - edge.value);
      guides.push({ axis: "h", position: best.pos });
      break;
    }
  }

  // Fall back to grid snap if no edge snap engaged.
  if (!guides.some((g) => g.axis === "v")) {
    if (mode === "move") {
      const nx = snapToGrid(x);
      x = nx;
    } else if (mode.includes("l")) {
      const old = x;
      x = snapToGrid(x);
      w -= x - old;
    } else if (mode.includes("r")) {
      const right = snapToGrid(x + w);
      w = right - x;
    }
  }
  if (!guides.some((g) => g.axis === "h")) {
    if (mode === "move") {
      y = snapToGrid(y);
    } else if (mode.startsWith("resize-t") || mode === "resize-tl" || mode === "resize-tr") {
      const old = y;
      y = snapToGrid(y);
      h -= y - old;
    } else if (mode.startsWith("resize-b") || mode === "resize-bl" || mode === "resize-br") {
      const bottom = snapToGrid(y + h);
      h = bottom - y;
    }
  }

  return { box: { x, y, w, h }, guides };
}
