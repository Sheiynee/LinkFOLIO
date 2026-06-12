"use client";

import type { Element } from "@/lib/elements";
import type { GapHint, SnapGuide } from "@/lib/canvas-snap";

/** Bounding box of a selection set in canvas coordinates. */
export interface SelectionBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function bboxOf(elements: Element[]): SelectionBox | null {
  if (elements.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of elements) {
    minX = Math.min(minX, e.x);
    minY = Math.min(minY, e.y);
    maxX = Math.max(maxX, e.x + e.w);
    maxY = Math.max(maxY, e.y + e.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export type HandleId =
  | "tl" | "t" | "tr"
  | "l"        | "r"
  | "bl" | "b" | "br"
  | "rot";

const HANDLE_SIZE = 10;
/**
 * Larger transparent hit area surrounding the visible handle. Keeps the visual
 * footprint small on desktop while giving touch users a comfortable target.
 */
const HANDLE_HIT = 22;

const HANDLE_CURSORS: Record<HandleId, string> = {
  tl: "nwse-resize",
  t: "ns-resize",
  tr: "nesw-resize",
  l: "ew-resize",
  r: "ew-resize",
  bl: "nesw-resize",
  b: "ns-resize",
  br: "nwse-resize",
  rot: "grab",
};

const HANDLE_POSITIONS: Record<HandleId, { left?: number; right?: number; top?: number; bottom?: number; transform?: string }> = {
  tl: { left: -HANDLE_HIT / 2, top: -HANDLE_HIT / 2 },
  t:  { left: "50%" as unknown as number, top: -HANDLE_HIT / 2, transform: "translateX(-50%)" },
  tr: { right: -HANDLE_HIT / 2, top: -HANDLE_HIT / 2 },
  l:  { left: -HANDLE_HIT / 2, top: "50%" as unknown as number, transform: "translateY(-50%)" },
  r:  { right: -HANDLE_HIT / 2, top: "50%" as unknown as number, transform: "translateY(-50%)" },
  bl: { left: -HANDLE_HIT / 2, bottom: -HANDLE_HIT / 2 },
  b:  { left: "50%" as unknown as number, bottom: -HANDLE_HIT / 2, transform: "translateX(-50%)" },
  br: { right: -HANDLE_HIT / 2, bottom: -HANDLE_HIT / 2 },
  rot: { left: "50%" as unknown as number, top: -28 - (HANDLE_HIT - HANDLE_SIZE) / 2, transform: "translateX(-50%)" },
};

export function SelectionOverlay({
  box,
  rotation,
  showResize,
  showRotate,
}: {
  box: SelectionBox;
  rotation?: number;
  showResize: boolean;
  showRotate: boolean;
}) {
  const handles: HandleId[] = showResize ? ["tl", "t", "tr", "l", "r", "bl", "b", "br"] : [];
  return (
    <div
      aria-hidden
      className="absolute pointer-events-none"
      style={{
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        // Elements rotate about their center (CSS default origin) — the
        // overlay must match or handles drift off the rotated box.
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: "50% 50%",
        zIndex: 9999,
      }}
    >
      <div className="absolute inset-0 border-2 border-blue-500 rounded-sm" />
      {handles.map((h) => (
        <div
          key={h}
          data-handle={h}
          className="absolute flex items-center justify-center pointer-events-auto"
          style={{
            width: HANDLE_HIT,
            height: HANDLE_HIT,
            cursor: HANDLE_CURSORS[h],
            touchAction: "none",
            ...HANDLE_POSITIONS[h],
          }}
        >
          <div
            className="bg-white border-2 border-blue-500 rounded-sm"
            style={{ width: HANDLE_SIZE, height: HANDLE_SIZE }}
          />
        </div>
      ))}
      {showRotate && (
        <>
          {/* Stem connecting rotation handle to the box */}
          <div
            className="absolute bg-blue-500 pointer-events-none"
            style={{
              left: "50%",
              top: -22,
              width: 2,
              height: 22,
              transform: "translateX(-50%)",
            }}
          />
          <div
            data-handle="rot"
            className="absolute flex items-center justify-center pointer-events-auto"
            style={{
              width: HANDLE_HIT,
              height: HANDLE_HIT,
              cursor: HANDLE_CURSORS.rot,
              touchAction: "none",
              ...HANDLE_POSITIONS.rot,
            }}
          >
            <div
              className="bg-white border-2 border-blue-500 rounded-full"
              style={{ width: HANDLE_SIZE + 2, height: HANDLE_SIZE + 2 }}
            />
          </div>
        </>
      )}
    </div>
  );
}

export function SnapGuides({ guides, height }: { guides: SnapGuide[]; height: number }) {
  return (
    <>
      {guides.map((g, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute pointer-events-none"
          style={
            g.axis === "v"
              ? { left: g.position, top: 0, width: 1, height, background: "rgba(59,130,246,0.9)" }
              : { left: 0, top: g.position, width: "100%", height: 1, background: "rgba(59,130,246,0.9)" }
          }
        />
      ))}
    </>
  );
}

const GAP_COLOR = "rgba(244,63,94,0.9)"; // rose-500 — distinct from the blue edge guides

/**
 * Figma-style equal-spacing hints: a bar with end ticks across each equal
 * gap, plus the gap size in px.
 */
export function GapIndicators({ gaps }: { gaps: GapHint[] }) {
  return (
    <>
      {gaps.map((g, i) => {
        const size = Math.round(g.to - g.from);
        const horizontal = g.axis === "x";
        return (
          <div
            key={i}
            aria-hidden
            className="absolute pointer-events-none"
            style={
              horizontal
                ? { left: g.from, top: g.cross - 4, width: g.to - g.from, height: 9 }
                : { left: g.cross - 4, top: g.from, width: 9, height: g.to - g.from }
            }
          >
            {/* bar */}
            <div
              className="absolute"
              style={
                horizontal
                  ? { left: 0, right: 0, top: 4, height: 1, background: GAP_COLOR }
                  : { top: 0, bottom: 0, left: 4, width: 1, background: GAP_COLOR }
              }
            />
            {/* end ticks */}
            {([0, 1] as const).map((end) => (
              <div
                key={end}
                className="absolute"
                style={
                  horizontal
                    ? { [end === 0 ? "left" : "right"]: 0, top: 0, width: 1, height: 9, background: GAP_COLOR }
                    : { [end === 0 ? "top" : "bottom"]: 0, left: 0, height: 1, width: 9, background: GAP_COLOR }
                }
              />
            ))}
            <span
              className="absolute text-[9px] font-mono leading-none px-0.5 rounded-sm"
              style={{
                background: GAP_COLOR,
                color: "white",
                left: "50%",
                top: "50%",
                transform: horizontal ? "translate(-50%, 4px)" : "translate(6px, -50%)",
              }}
            >
              {size}
            </span>
          </div>
        );
      })}
    </>
  );
}

export function MarqueeBox({ box }: { box: SelectionBox | null }) {
  if (!box) return null;
  return (
    <div
      aria-hidden
      className="absolute pointer-events-none border border-blue-500 bg-blue-500/10"
      style={{ left: box.x, top: box.y, width: box.w, height: box.h, zIndex: 9998 }}
    />
  );
}
