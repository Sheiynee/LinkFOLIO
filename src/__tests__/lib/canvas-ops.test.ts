import { describe, it, expect } from "vitest";
import {
  computeNudge,
  computeGroupOp,
  computeZOrder,
  computeZMove,
  computeZoomScroll,
  nextZoom,
  resizeRotatedBox,
  MIN_ZOOM,
  MAX_ZOOM,
} from "@/lib/canvas-ops";
import { MOBILE_INSET_TOP, MOBILE_INSET_X } from "@/lib/canvas-mobile";
import type { Element } from "@/lib/elements";

function el(partial: Partial<Element> & { id: string }): Element {
  return {
    type: "text",
    title: null,
    url: null,
    content: null,
    x: 0,
    y: 0,
    w: 100,
    h: 40,
    rotation: 0,
    z: 0,
    ...partial,
  };
}

describe("computeNudge", () => {
  it("desktop: server patches carry the NEW coordinates, not the stale ones", () => {
    const elements = [el({ id: "a", x: 50, y: 60 }), el({ id: "b", x: 200, y: 300 })];
    const r = computeNudge(elements, ["a"], 10, -5, "desktop");
    expect(r.next.find((e) => e.id === "a")).toMatchObject({ x: 60, y: 55 });
    expect(r.next.find((e) => e.id === "b")).toMatchObject({ x: 200, y: 300 });
    expect(r.desktopPatches).toEqual([{ id: "a", patch: { x: 60, y: 55 } }]);
    expect(r.mobilePatches).toEqual([]);
  });

  it("mobile: nudges from the auto-reflow position when no override exists", () => {
    const elements = [el({ id: "a", y: 10 })];
    const r = computeNudge(elements, ["a"], 4, 6, "mobile");
    // auto-reflow places the first element at (MOBILE_INSET_X, MOBILE_INSET_TOP)
    const expected = { mobile_x: MOBILE_INSET_X + 4, mobile_y: MOBILE_INSET_TOP + 6 };
    expect(r.next.find((e) => e.id === "a")).toMatchObject(expected);
    expect(r.mobilePatches).toEqual([
      { id: "a", ...expected, mobile_w: null, mobile_h: null },
    ]);
    expect(r.desktopPatches).toEqual([]);
  });

  it("mobile: preserves existing mobile size overrides in the patch", () => {
    const elements = [el({ id: "a", mobile_x: 30, mobile_y: 40, mobile_w: 120, mobile_h: 50 })];
    const r = computeNudge(elements, ["a"], 1, 1, "mobile");
    expect(r.mobilePatches).toEqual([
      { id: "a", mobile_x: 31, mobile_y: 41, mobile_w: 120, mobile_h: 50 },
    ]);
  });
});

describe("computeGroupOp", () => {
  it("desktop align-l moves every element to the selection's left edge", () => {
    const elements = [el({ id: "a", x: 50 }), el({ id: "b", x: 200 })];
    const r = computeGroupOp(elements, ["a", "b"], "align-l", "desktop");
    expect(r.next.find((e) => e.id === "b")!.x).toBe(50);
    expect(r.desktopPatches).toContainEqual(
      expect.objectContaining({ id: "b", patch: expect.objectContaining({ x: 50 }) })
    );
    expect(r.mobilePatches).toEqual([]);
  });

  it("desktop dist-h spaces three elements evenly", () => {
    const elements = [
      el({ id: "a", x: 0, w: 100 }),
      el({ id: "b", x: 110, w: 100 }),
      el({ id: "c", x: 400, w: 100 }),
    ];
    const r = computeGroupOp(elements, ["a", "b", "c"], "dist-h", "desktop");
    expect(r.next.find((e) => e.id === "b")!.x).toBe(200);
  });

  it("mobile align-l writes mobile overrides and leaves desktop coords alone", () => {
    const elements = [
      el({ id: "a", x: 50, mobile_x: 30, mobile_y: 100 }),
      el({ id: "b", x: 200, mobile_x: 80, mobile_y: 300 }),
    ];
    const r = computeGroupOp(elements, ["a", "b"], "align-l", "mobile");
    const b = r.next.find((e) => e.id === "b")!;
    expect(b.mobile_x).toBe(30);
    expect(b.x).toBe(200); // desktop untouched
    expect(r.desktopPatches).toEqual([]);
    expect(r.mobilePatches).toContainEqual({
      id: "b",
      mobile_x: 30,
      mobile_y: 300,
      mobile_w: null,
      mobile_h: null,
    });
  });
});

describe("computeZOrder", () => {
  const stack = () => [
    el({ id: "a", z: 0 }),
    el({ id: "b", z: 1 }),
    el({ id: "c", z: 2 }),
  ];

  function zOf(r: { next: Element[] }, id: string) {
    return r.next.find((e) => e.id === id)!.z;
  }

  it("bring to front puts the selection above everything", () => {
    const r = computeZOrder(stack(), ["a"], "front");
    expect(zOf(r, "a")).toBe(2);
    expect(zOf(r, "b")).toBe(0);
    expect(zOf(r, "c")).toBe(1);
    expect(r.patches.length).toBeGreaterThan(0);
  });

  it("send to back puts the selection below everything", () => {
    const r = computeZOrder(stack(), ["c"], "back");
    expect(zOf(r, "c")).toBe(0);
    expect(zOf(r, "a")).toBe(1);
    expect(zOf(r, "b")).toBe(2);
  });

  it("bring forward swaps with the next element above", () => {
    const r = computeZOrder(stack(), ["a"], "forward");
    expect(zOf(r, "a")).toBe(1);
    expect(zOf(r, "b")).toBe(0);
    expect(zOf(r, "c")).toBe(2);
  });

  it("send backward swaps with the next element below", () => {
    const r = computeZOrder(stack(), ["c"], "backward");
    expect(zOf(r, "c")).toBe(1);
    expect(zOf(r, "b")).toBe(2);
  });

  it("forward at the top is a no-op with no patches", () => {
    const r = computeZOrder(stack(), ["c"], "forward");
    expect(r.patches).toEqual([]);
  });

  it("multi-select front preserves relative order of the selection", () => {
    const r = computeZOrder(stack(), ["a", "b"], "front");
    expect(zOf(r, "c")).toBe(0);
    expect(zOf(r, "a")).toBe(1);
    expect(zOf(r, "b")).toBe(2);
  });

  it("patches only contain elements whose z changed", () => {
    const r = computeZOrder(stack(), ["b"], "forward");
    // a stays at z 0 — only b and c swap.
    expect(r.patches.map((p) => p.id).sort()).toEqual(["b", "c"]);
  });
});

describe("computeZMove", () => {
  // Note: z values intentionally sparse to verify renormalization.
  const stack = () => [
    el({ id: "a", z: 0 }),
    el({ id: "b", z: 3 }),
    el({ id: "c", z: 7 }),
  ];

  function zOf(r: { next: Element[] }, id: string) {
    return r.next.find((e) => e.id === id)!.z;
  }

  it("moves the bottom element to the top of the paint order", () => {
    const r = computeZMove(stack(), "a", 2);
    expect(zOf(r, "a")).toBe(2);
    expect(zOf(r, "b")).toBe(0);
    expect(zOf(r, "c")).toBe(1);
  });

  it("moves the top element to the bottom", () => {
    const r = computeZMove(stack(), "c", 0);
    expect(zOf(r, "c")).toBe(0);
    expect(zOf(r, "a")).toBe(1);
    expect(zOf(r, "b")).toBe(2);
  });

  it("moves an element to a middle slot", () => {
    const r = computeZMove(stack(), "c", 1);
    expect(zOf(r, "a")).toBe(0);
    expect(zOf(r, "c")).toBe(1);
    expect(zOf(r, "b")).toBe(2);
  });

  it("renormalizes sparse z values even when order is unchanged", () => {
    const r = computeZMove(stack(), "b", 1);
    expect(zOf(r, "a")).toBe(0);
    expect(zOf(r, "b")).toBe(1);
    expect(zOf(r, "c")).toBe(2);
    // a kept z 0 — only b and c get patched down to dense indices.
    expect(r.patches.map((p) => p.id).sort()).toEqual(["b", "c"]);
  });

  it("clamps a target index past the end to the top", () => {
    const r = computeZMove(stack(), "a", 99);
    expect(zOf(r, "a")).toBe(2);
  });

  it("clamps a negative target index to the bottom", () => {
    const r = computeZMove(stack(), "c", -5);
    expect(zOf(r, "c")).toBe(0);
  });

  it("returns no patches when nothing changes", () => {
    const dense = [el({ id: "a", z: 0 }), el({ id: "b", z: 1 })];
    const r = computeZMove(dense, "b", 1);
    expect(r.patches).toEqual([]);
    expect(r.next).toEqual(dense);
  });

  it("is a no-op for an unknown id", () => {
    const dense = [el({ id: "a", z: 0 }), el({ id: "b", z: 1 })];
    const r = computeZMove(dense, "nope", 0);
    expect(r.patches).toEqual([]);
  });
});

describe("nextZoom", () => {
  it("wheel up (negative deltaY) zooms in, wheel down zooms out", () => {
    expect(nextZoom(1, -100)).toBeGreaterThan(1);
    expect(nextZoom(1, 100)).toBeLessThan(1);
  });

  it("is multiplicative: equal steps compose symmetrically", () => {
    const zoomedIn = nextZoom(1, -100);
    const backOut = nextZoom(zoomedIn, 100);
    expect(backOut).toBeCloseTo(1, 10);
  });

  it("clamps to the zoom range", () => {
    expect(nextZoom(MAX_ZOOM, -1000)).toBe(MAX_ZOOM);
    expect(nextZoom(MIN_ZOOM, 1000)).toBe(MIN_ZOOM);
  });
});

describe("computeZoomScroll", () => {
  it("keeps the content point under the cursor stationary", () => {
    const cursor = { x: 150, y: 80 };
    const scroll = { left: 200, top: 400 };
    const prevZoom = 1;
    const newZoom = 2;
    const s = computeZoomScroll(prevZoom, newZoom, cursor, scroll);
    // Content coordinate under the cursor before and after must match.
    const before = { x: (scroll.left + cursor.x) / prevZoom, y: (scroll.top + cursor.y) / prevZoom };
    const after = { x: (s.left + cursor.x) / newZoom, y: (s.top + cursor.y) / newZoom };
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("zoom at the origin with no scroll stays at the origin", () => {
    expect(computeZoomScroll(1, 2, { x: 0, y: 0 }, { left: 0, top: 0 })).toEqual({ left: 0, top: 0 });
  });
});

describe("resizeRotatedBox", () => {
  const start = { x: 100, y: 100, w: 80, h: 40 };

  it("matches plain resize when rotation is 0 (right handle)", () => {
    expect(resizeRotatedBox(start, 0, "r", 20, 0, 10, 10)).toEqual({ x: 100, y: 100, w: 100, h: 40 });
  });

  it("matches plain resize when rotation is 0 (left handle keeps right edge fixed)", () => {
    expect(resizeRotatedBox(start, 0, "l", 10, 0, 10, 10)).toEqual({ x: 110, y: 100, w: 70, h: 40 });
  });

  it("clamps to min size while keeping the anchored edge fixed", () => {
    const r = resizeRotatedBox(start, 0, "l", 75, 0, 20, 10);
    expect(r.w).toBe(20);
    expect(r.x + r.w).toBe(180); // right edge unchanged
  });

  it("maps screen deltas into local space for a 90° rotated box", () => {
    // Box rotated 90°: its local right edge points screen-down, so dragging
    // down by 30 grows the width by 30 and shifts the center down by 15.
    const r = resizeRotatedBox(start, 90, "r", 0, 30, 10, 10);
    expect(r.w).toBeCloseTo(110);
    expect(r.h).toBeCloseTo(40);
    expect(r.x).toBeCloseTo(85); // cx 140 stays, x = 140 - 55
    expect(r.y).toBeCloseTo(115); // cy 120 + 15 - 20
  });

  it("corner handle resizes both axes", () => {
    const r = resizeRotatedBox(start, 0, "br", 20, 10, 10, 10);
    expect(r).toEqual({ x: 100, y: 100, w: 100, h: 50 });
  });
});
