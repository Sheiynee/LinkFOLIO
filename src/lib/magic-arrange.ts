/**
 * Magic-arrange heuristics — three deterministic layouts that take a set of
 * canvas elements and reshuffle their positions into a coherent composition.
 * Pure client-side: each function returns a list of `{ id, x, y, w, h }`
 * patches that the editor commits with a single `batchUpdateElements` call.
 *
 * The functions only touch *positioning* — type, content, rotation, and z
 * are left alone. Regions are excluded from the arrangement because they
 * act as backdrops, not flow content.
 */

import type { Element } from "./elements";
import { CANVAS_WIDTH } from "./elements";

export type ArrangePatch = { id: string; x: number; y: number; w: number; h: number };
export type ArrangeKind = "grid" | "asymmetric" | "hero";

/** Top inset the avatar/name/bio header occupies. */
const HEADER_INSET = 220;
const SIDE_INSET = 24;
const GAP = 16;

interface Candidate {
  el: Element;
  /** Original aspect ratio so the new layout doesn't distort the element. */
  ratio: number;
}

function arrangeable(elements: Element[]): Candidate[] {
  return elements
    .filter((e) => e.type !== "region" && e.visible !== false)
    .map((el) => ({ el, ratio: el.h > 0 ? el.w / el.h : 1 }))
    .sort((a, b) => b.el.w * b.el.h - a.el.w * a.el.h);
}

/** 2-column grid (or single column when fewer than 4 elements). */
export function arrangeGrid(elements: Element[]): ArrangePatch[] {
  const items = arrangeable(elements);
  if (items.length === 0) return [];
  const cols = items.length >= 4 ? 2 : 1;
  const colW = Math.floor((CANVAS_WIDTH - SIDE_INSET * 2 - GAP * (cols - 1)) / cols);
  const rows = Math.ceil(items.length / cols);
  const patches: ArrangePatch[] = [];
  let yCursor = HEADER_INSET;
  for (let r = 0; r < rows; r++) {
    const rowItems = items.slice(r * cols, (r + 1) * cols);
    const rowH = rowItems.reduce((m, it) => Math.max(m, Math.round(colW / it.ratio)), 0);
    for (let c = 0; c < rowItems.length; c++) {
      const it = rowItems[c];
      patches.push({
        id: it.el.id,
        x: SIDE_INSET + c * (colW + GAP),
        y: yCursor,
        w: colW,
        h: Math.round(colW / it.ratio),
      });
    }
    yCursor += rowH + GAP;
  }
  return patches;
}

/**
 * Alternating offsets — every other element drifts toward the opposite edge by
 * a golden-ratio fraction of the canvas width. Widths shrink toward the
 * golden ratio to keep the composition airy.
 */
export function arrangeAsymmetric(elements: Element[]): ArrangePatch[] {
  const items = arrangeable(elements);
  if (items.length === 0) return [];
  const phi = 0.618;
  const baseW = Math.round((CANVAS_WIDTH - SIDE_INSET * 2) * phi);
  const offsets = [SIDE_INSET, CANVAS_WIDTH - SIDE_INSET - baseW];
  let yCursor = HEADER_INSET;
  const patches: ArrangePatch[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    // Alternate sides; mid items use a slightly different width so the eye
    // doesn't read it as a rigid two-column grid.
    const wiggle = i % 3 === 0 ? 0 : i % 3 === 1 ? 30 : -30;
    const w = Math.max(120, Math.min(CANVAS_WIDTH - SIDE_INSET * 2, baseW + wiggle));
    const h = Math.max(40, Math.round(w / it.ratio));
    patches.push({
      id: it.el.id,
      x: offsets[i % 2],
      y: yCursor,
      w,
      h,
    });
    yCursor += h + GAP;
  }
  return patches;
}

/** One full-width hero, the rest tiled in a 2-column grid below it. */
export function arrangeHero(elements: Element[]): ArrangePatch[] {
  const items = arrangeable(elements);
  if (items.length === 0) return [];
  const hero = items[0];
  const heroW = CANVAS_WIDTH - SIDE_INSET * 2;
  const heroH = Math.max(120, Math.round(heroW / hero.ratio));
  const patches: ArrangePatch[] = [
    { id: hero.el.id, x: SIDE_INSET, y: HEADER_INSET, w: heroW, h: heroH },
  ];

  const rest = items.slice(1);
  if (rest.length === 0) return patches;
  const cols = 2;
  const colW = Math.floor((CANVAS_WIDTH - SIDE_INSET * 2 - GAP) / cols);
  let yCursor = HEADER_INSET + heroH + GAP;
  for (let i = 0; i < rest.length; i += cols) {
    const row = rest.slice(i, i + cols);
    const rowH = row.reduce((m, it) => Math.max(m, Math.round(colW / it.ratio)), 0);
    for (let c = 0; c < row.length; c++) {
      const it = row[c];
      patches.push({
        id: it.el.id,
        x: SIDE_INSET + c * (colW + GAP),
        y: yCursor,
        w: colW,
        h: Math.round(colW / it.ratio),
      });
    }
    yCursor += rowH + GAP;
  }
  return patches;
}

export function arrange(kind: ArrangeKind, elements: Element[]): ArrangePatch[] {
  switch (kind) {
    case "grid": return arrangeGrid(elements);
    case "asymmetric": return arrangeAsymmetric(elements);
    case "hero": return arrangeHero(elements);
  }
}
