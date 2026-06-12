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

/**
 * One highlighted gap for the equal-spacing hint: a span [from..to] along
 * `axis`, drawn at `cross` on the other axis.
 */
export interface GapHint {
  axis: "x" | "y";
  from: number;
  to: number;
  cross: number;
}

export interface SnapResult {
  box: Box;
  guides: SnapGuide[];
  gaps: GapHint[];
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
function candidates(others: Element[], canvasWidth: number) {
  const vert: number[] = [0, canvasWidth / 2, canvasWidth];
  const horiz: number[] = []; // No fixed canvas height (it grows).
  for (const e of others) {
    vert.push(e.x, e.x + e.w / 2, e.x + e.w);
    horiz.push(e.y, e.y + e.h / 2, e.y + e.h);
  }
  return { vert, horiz };
}

interface Span { start: number; end: number }

/**
 * Figma-style equal-spacing snap along one axis. Given the moving box's
 * main-axis start/size and the other elements' main-axis spans (already
 * filtered to those overlapping the box on the cross axis), find a position
 * where the box repeats an existing gap (after / before a pair) or sits
 * exactly between two elements. Returns the best candidate within the guide
 * threshold, with the two equal gaps to highlight.
 */
function equalSpacing(
  boxStart: number,
  boxSize: number,
  boxCross: number,
  spans: Span[],
  axis: "x" | "y"
): { pos: number; gaps: GapHint[] } | null {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let best: { pos: number; gaps: GapHint[]; dist: number } | null = null;

  function consider(pos: number, segs: Span[]) {
    const dist = Math.abs(boxStart - pos);
    if (dist > GUIDE_THRESHOLD) return;
    if (best && dist >= best.dist) return;
    best = {
      pos,
      dist,
      gaps: segs.map((s) => ({ axis, from: s.start, to: s.end, cross: boxCross })),
    };
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const gap = b.start - a.end;
    if (gap <= 0) continue;
    // Repeat the pair's gap after b…
    consider(b.end + gap, [
      { start: a.end, end: b.start },
      { start: b.end, end: b.end + gap },
    ]);
    // …or before a.
    consider(a.start - gap - boxSize, [
      { start: a.start - gap, end: a.start },
      { start: a.end, end: b.start },
    ]);
    // Or center the box between a and b (equal gaps on both sides).
    if (gap >= boxSize) {
      const pos = a.end + (gap - boxSize) / 2;
      consider(pos, [
        { start: a.end, end: pos },
        { start: pos + boxSize, end: b.start },
      ]);
    }
  }
  return best;
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
  mode: "move" | "resize-l" | "resize-r" | "resize-t" | "resize-b" | "resize-tl" | "resize-tr" | "resize-bl" | "resize-br" = "move",
  canvasWidth: number = CANVAS_WIDTH
): SnapResult {
  const { vert, horiz } = candidates(others, canvasWidth);
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

  // Equal-spacing snap (move only): when no edge snap engaged on an axis,
  // try to repeat an existing gap between neighbors in the box's band.
  const gaps: GapHint[] = [];
  if (mode === "move") {
    if (!guides.some((g) => g.axis === "v")) {
      const band = others.filter((o) => o.y < y + h && o.y + o.h > y);
      const r = equalSpacing(x, w, y + h / 2, band.map((o) => ({ start: o.x, end: o.x + o.w })), "x");
      if (r) {
        x = r.pos;
        gaps.push(...r.gaps);
      }
    }
    if (!guides.some((g) => g.axis === "h")) {
      const band = others.filter((o) => o.x < x + w && o.x + o.w > x);
      const r = equalSpacing(y, h, x + w / 2, band.map((o) => ({ start: o.y, end: o.y + o.h })), "y");
      if (r) {
        y = r.pos;
        gaps.push(...r.gaps);
      }
    }
  }

  // Fall back to grid snap if no edge or spacing snap engaged.
  if (!guides.some((g) => g.axis === "v") && !gaps.some((g) => g.axis === "x")) {
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
  if (!guides.some((g) => g.axis === "h") && !gaps.some((g) => g.axis === "y")) {
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

  return { box: { x, y, w, h }, guides, gaps };
}
