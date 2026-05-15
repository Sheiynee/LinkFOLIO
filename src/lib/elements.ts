import type { BlockType } from "./blocks";
import type { WidgetKind } from "./widgets/types";

/** Fixed canvas dimensions in CSS px. Mobile reflow lands in Phase 4b. */
export const CANVAS_WIDTH = 600;
/** Initial canvas height; the public page can grow when elements extend past it. */
export const CANVAS_HEIGHT = 900;
/** Minimum element box, used for resize clamping (Part 2). */
export const MIN_ELEMENT_W = 80;
export const MIN_ELEMENT_H = 32;
/** Heights used when migrating block→element so the stacked layout looks correct. */
export const DEFAULT_ELEMENT_HEIGHTS: Record<BlockType, number> = {
  link: 56,
  text: 80,
  heading: 56,
  divider: 24,
  widget: 96,
};
/** Vertical gap between stacked elements during block→element migration. */
export const STACK_GAP_Y = 12;
/** Inset from the canvas edges for the stacked migration result. */
export const STACK_INSET_X = 24;
export const STACK_INSET_TOP = 220; // leave room for avatar + display name + bio

export type ElementType = BlockType;

export interface Element {
  id: string;
  type: ElementType;
  title: string | null;
  url: string | null;
  content: string | null;
  visible?: boolean;
  widget_kind?: WidgetKind | null;
  meta?: Record<string, unknown> | null;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  z: number;
  locked?: boolean;
  mobile_x?: number | null;
  mobile_y?: number | null;
  mobile_w?: number | null;
  mobile_h?: number | null;
}

export type LayoutMode = "stack" | "canvas";

/** Sort elements bottom→top so later (higher-z) elements paint over earlier ones. */
export function sortElementsForPaint(elements: Element[]): Element[] {
  return [...elements].sort((a, b) => a.z - b.z);
}

/**
 * Build a default vertical-stack layout for blocks being migrated into the
 * canvas. Each block becomes an element directly below the previous one,
 * centered on the canvas.
 */
export function stackLayoutForBlocks<T extends { type: BlockType }>(
  blocks: T[],
  startY: number = STACK_INSET_TOP
): { x: number; y: number; w: number; h: number }[] {
  const w = CANVAS_WIDTH - STACK_INSET_X * 2;
  let y = startY;
  return blocks.map((b) => {
    const h = DEFAULT_ELEMENT_HEIGHTS[b.type] ?? 56;
    const slot = { x: STACK_INSET_X, y, w, h };
    y += h + STACK_GAP_Y;
    return slot;
  });
}

/** The lowest free z-index above all current elements. */
export function nextZ(elements: Element[]): number {
  if (elements.length === 0) return 0;
  return Math.max(...elements.map((e) => e.z)) + 1;
}
