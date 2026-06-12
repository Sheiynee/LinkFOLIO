import type { Element } from "./elements";
import { placementsForMobile } from "./canvas-mobile";

export type CanvasView = "desktop" | "mobile";

export type GroupOp =
  | "align-l" | "align-c" | "align-r"
  | "align-t" | "align-m" | "align-b"
  | "dist-h" | "dist-v";

export type ResizeHandle = "l" | "r" | "t" | "b" | "tl" | "tr" | "bl" | "br";

export interface Box { x: number; y: number; w: number; h: number }

export interface PlacementOpResult {
  next: Element[];
  desktopPatches: { id: string; patch: { x?: number; y?: number } }[];
  mobilePatches: {
    id: string;
    mobile_x: number | null;
    mobile_y: number | null;
    mobile_w: number | null;
    mobile_h: number | null;
  }[];
}

/**
 * Turn per-id position moves into both the next local state and the server
 * patches, computed from the SAME source array so the saved values can never
 * drift from what's rendered. In mobile view, moves write `mobile_*`
 * overrides (starting from the auto-reflow position when no override exists)
 * and preserve any existing size overrides.
 */
function applyMoves(
  elements: Element[],
  moves: Map<string, { x: number; y: number }>,
  view: CanvasView
): PlacementOpResult {
  const desktopPatches: PlacementOpResult["desktopPatches"] = [];
  const mobilePatches: PlacementOpResult["mobilePatches"] = [];
  const next = elements.map((e) => {
    const to = moves.get(e.id);
    if (!to) return e;
    if (view === "mobile") {
      mobilePatches.push({
        id: e.id,
        mobile_x: to.x,
        mobile_y: to.y,
        mobile_w: e.mobile_w ?? null,
        mobile_h: e.mobile_h ?? null,
      });
      return { ...e, mobile_x: to.x, mobile_y: to.y };
    }
    desktopPatches.push({ id: e.id, patch: { x: to.x, y: to.y } });
    return { ...e, x: to.x, y: to.y };
  });
  return { next, desktopPatches, mobilePatches };
}

/** The box the user actually sees for an element in the given view. */
function viewBoxes(elements: Element[], view: CanvasView): Record<string, Box> {
  if (view === "desktop") {
    return Object.fromEntries(elements.map((e) => [e.id, { x: e.x, y: e.y, w: e.w, h: e.h }]));
  }
  return placementsForMobile(elements);
}

export function computeNudge(
  elements: Element[],
  ids: string[],
  dx: number,
  dy: number,
  view: CanvasView
): PlacementOpResult {
  const boxes = viewBoxes(elements, view);
  const moves = new Map<string, { x: number; y: number }>();
  for (const id of ids) {
    const b = boxes[id];
    if (b) moves.set(id, { x: b.x + dx, y: b.y + dy });
  }
  return applyMoves(elements, moves, view);
}

export function computeGroupOp(
  elements: Element[],
  ids: string[],
  op: GroupOp,
  view: CanvasView
): PlacementOpResult {
  const boxes = viewBoxes(elements, view);
  const selected = ids
    .map((id) => (boxes[id] ? { id, ...boxes[id] } : null))
    .filter((b): b is Box & { id: string } => b !== null);
  const empty: PlacementOpResult = { next: elements, desktopPatches: [], mobilePatches: [] };
  if (selected.length < 2) return empty;
  if ((op === "dist-h" || op === "dist-v") && selected.length < 3) return empty;

  const minX = Math.min(...selected.map((b) => b.x));
  const minY = Math.min(...selected.map((b) => b.y));
  const maxR = Math.max(...selected.map((b) => b.x + b.w));
  const maxB = Math.max(...selected.map((b) => b.y + b.h));

  const moves = new Map<string, { x: number; y: number }>();
  const move = (b: Box & { id: string }, x: number, y: number) =>
    moves.set(b.id, { x: Math.round(x), y: Math.round(y) });

  if (op === "align-l") {
    for (const b of selected) move(b, minX, b.y);
  } else if (op === "align-c") {
    const cx = (minX + maxR) / 2;
    for (const b of selected) move(b, cx - b.w / 2, b.y);
  } else if (op === "align-r") {
    for (const b of selected) move(b, maxR - b.w, b.y);
  } else if (op === "align-t") {
    for (const b of selected) move(b, b.x, minY);
  } else if (op === "align-m") {
    const cy = (minY + maxB) / 2;
    for (const b of selected) move(b, b.x, cy - b.h / 2);
  } else if (op === "align-b") {
    for (const b of selected) move(b, b.x, maxB - b.h);
  } else if (op === "dist-h") {
    const sorted = [...selected].sort((a, b) => a.x - b.x);
    const totalGap = maxR - minX - sorted.reduce((s, b) => s + b.w, 0);
    const gap = totalGap / (sorted.length - 1);
    let cursor = minX;
    for (const b of sorted) {
      move(b, cursor, b.y);
      cursor += b.w + gap;
    }
  } else if (op === "dist-v") {
    const sorted = [...selected].sort((a, b) => a.y - b.y);
    const totalGap = maxB - minY - sorted.reduce((s, b) => s + b.h, 0);
    const gap = totalGap / (sorted.length - 1);
    let cursor = minY;
    for (const b of sorted) {
      move(b, b.x, cursor);
      cursor += b.h + gap;
    }
  }

  return applyMoves(elements, moves, view);
}

export type ZOrderDir = "front" | "forward" | "backward" | "back";

export interface ZOrderResult {
  next: Element[];
  patches: { id: string; patch: { z: number } }[];
}

/**
 * Reorder the paint stack. Works on the full z ordering and renormalizes z
 * to sequential indices, so repeated operations can't accumulate gaps or
 * collisions. Multi-selections keep their relative order; forward/backward
 * step past one unselected neighbor.
 */
export function computeZOrder(
  elements: Element[],
  ids: string[],
  dir: ZOrderDir
): ZOrderResult {
  const selected = new Set(ids);
  const order = [...elements].sort((a, b) => a.z - b.z).map((e) => e.id);

  if (dir === "front") {
    const rest = order.filter((id) => !selected.has(id));
    const sel = order.filter((id) => selected.has(id));
    order.splice(0, order.length, ...rest, ...sel);
  } else if (dir === "back") {
    const rest = order.filter((id) => !selected.has(id));
    const sel = order.filter((id) => selected.has(id));
    order.splice(0, order.length, ...sel, ...rest);
  } else if (dir === "forward") {
    for (let i = order.length - 2; i >= 0; i--) {
      if (selected.has(order[i]) && !selected.has(order[i + 1])) {
        [order[i], order[i + 1]] = [order[i + 1], order[i]];
      }
    }
  } else if (dir === "backward") {
    for (let i = 1; i < order.length; i++) {
      if (selected.has(order[i]) && !selected.has(order[i - 1])) {
        [order[i], order[i - 1]] = [order[i - 1], order[i]];
      }
    }
  }

  return renormalizeZ(elements, order);
}

/**
 * Move one element to a specific position in the paint order (0 = bottom,
 * length-1 = top), shifting the others around it. Renormalizes z to dense
 * sequential indices like computeZOrder. Backs the layers panel's
 * drag-to-reorder.
 */
export function computeZMove(
  elements: Element[],
  id: string,
  toIndex: number
): ZOrderResult {
  const order = [...elements].sort((a, b) => a.z - b.z).map((e) => e.id);
  const from = order.indexOf(id);
  if (from === -1) return { next: elements, patches: [] };
  const to = Math.max(0, Math.min(order.length - 1, toIndex));
  order.splice(from, 1);
  order.splice(to, 0, id);
  return renormalizeZ(elements, order);
}

/** Assign dense z indices from a bottom→top id ordering; patch only changes. */
function renormalizeZ(elements: Element[], order: string[]): ZOrderResult {
  const zById = new Map(order.map((id, i) => [id, i]));
  const patches: ZOrderResult["patches"] = [];
  const next = elements.map((e) => {
    const z = zById.get(e.id)!;
    if (z === e.z) return e;
    patches.push({ id: e.id, patch: { z } });
    return { ...e, z };
  });
  return { next: patches.length === 0 ? elements : next, patches };
}

/**
 * Resize a (possibly rotated) box from a pointer drag. The screen-space
 * pointer delta is rotated into the element's local frame, applied to the
 * dragged edges, and the box is re-anchored so the opposite edge/corner
 * stays fixed in world space. With rotation 0 this reduces to plain
 * axis-aligned resize.
 */
export function resizeRotatedBox(
  start: Box,
  rotationDeg: number,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  minW: number,
  minH: number
): Box {
  const theta = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  // Pointer delta in the element's local (unrotated) frame.
  const ldx = dx * cos + dy * sin;
  const ldy = -dx * sin + dy * cos;

  let w = start.w;
  let h = start.h;
  let dcx = 0; // local-frame center shift
  let dcy = 0;

  if (handle.includes("l")) {
    const nw = Math.max(minW, w - ldx);
    dcx = (w - nw) / 2;
    w = nw;
  } else if (handle.includes("r")) {
    const nw = Math.max(minW, w + ldx);
    dcx = (nw - w) / 2;
    w = nw;
  }
  if (handle.includes("t")) {
    const nh = Math.max(minH, h - ldy);
    dcy = (h - nh) / 2;
    h = nh;
  } else if (handle.includes("b")) {
    const nh = Math.max(minH, h + ldy);
    dcy = (nh - h) / 2;
    h = nh;
  }

  // Rotate the center shift back into world space so the anchor stays put.
  const cx = start.x + start.w / 2 + (dcx * cos - dcy * sin);
  const cy = start.y + start.h / 2 + (dcx * sin + dcy * cos);

  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
