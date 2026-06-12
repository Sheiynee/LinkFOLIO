import { describe, it, expect } from "vitest";
import { snap } from "@/lib/canvas-snap";
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

describe("snap canvas guides", () => {
  it("snaps to the desktop canvas center (300) by default", () => {
    const res = snap({ x: 297, y: 50, w: 100, h: 20 }, [], "move");
    expect(res.box.x).toBe(300);
    expect(res.guides).toContainEqual({ axis: "v", position: 300 });
  });

  it("snaps to the mobile canvas center (180) when given the mobile width", () => {
    const res = snap({ x: 178, y: 50, w: 100, h: 20 }, [], "move", 360);
    expect(res.box.x).toBe(180);
    expect(res.guides).toContainEqual({ axis: "v", position: 180 });
  });

  it("does not fire desktop-width guides on a mobile canvas", () => {
    // 297 is near the desktop center (300) but nowhere near mobile guides
    // (0 / 180 / 360) — it must fall back to grid snap, not show a guide.
    const res = snap({ x: 297, y: 50, w: 20, h: 20 }, [], "move", 360);
    expect(res.guides).toHaveLength(0);
    expect(res.box.x).toBe(296); // 8px grid
  });
});

describe("equal-spacing guides", () => {
  // A: x 0..100, B: x 120..220 (gap 20) — all sharing the y band of the box.
  const pair = [
    el({ id: "a", x: 0, y: 50, w: 100, h: 40 }),
    el({ id: "b", x: 120, y: 50, w: 100, h: 40 }),
  ];

  it("snaps the box after a pair to repeat their gap", () => {
    const res = snap({ x: 243, y: 50, w: 100, h: 40 }, pair, "move");
    expect(res.box.x).toBe(240); // 220 + gap 20
    expect(res.gaps).toEqual([
      { axis: "x", from: 100, to: 120, cross: 70 },
      { axis: "x", from: 220, to: 240, cross: 70 },
    ]);
  });

  it("snaps the box before a pair to repeat their gap", () => {
    const shifted = [
      el({ id: "a", x: 200, y: 50, w: 100, h: 40 }),
      el({ id: "b", x: 320, y: 50, w: 100, h: 40 }),
    ];
    const res = snap({ x: 83, y: 50, w: 100, h: 40 }, shifted, "move");
    expect(res.box.x).toBe(80); // 200 - 20 - 100
    expect(res.gaps).toEqual([
      { axis: "x", from: 180, to: 200, cross: 70 },
      { axis: "x", from: 300, to: 320, cross: 70 },
    ]);
  });

  it("snaps the box to the midpoint between two elements (equal gaps both sides)", () => {
    const wide = [
      el({ id: "a", x: 0, y: 50, w: 100, h: 40 }),
      el({ id: "b", x: 300, y: 50, w: 100, h: 40 }),
    ];
    const res = snap({ x: 152, y: 50, w: 100, h: 40 }, wide, "move");
    expect(res.box.x).toBe(150);
    expect(res.gaps).toEqual([
      { axis: "x", from: 100, to: 150, cross: 70 },
      { axis: "x", from: 250, to: 300, cross: 70 },
    ]);
  });

  it("ignores elements outside the box's vertical band", () => {
    const elsewhere = [
      el({ id: "a", x: 0, y: 500, w: 100, h: 40 }),
      el({ id: "b", x: 120, y: 500, w: 100, h: 40 }),
    ];
    const res = snap({ x: 243, y: 50, w: 100, h: 40 }, elsewhere, "move");
    expect(res.gaps).toEqual([]);
    expect(res.box.x).toBe(240); // plain grid snap (243 → 240)
  });

  it("does not engage when the box is too far from the equal-spacing position", () => {
    const res = snap({ x: 260, y: 50, w: 100, h: 40 }, pair, "move");
    expect(res.gaps).toEqual([]);
  });

  it("works vertically too", () => {
    const stackPair = [
      el({ id: "a", x: 50, y: 230, w: 100, h: 40 }), // 230..270
      el({ id: "b", x: 50, y: 290, w: 100, h: 40 }), // 290..330, gap 20
    ];
    const res = snap({ x: 50, y: 353, w: 100, h: 40 }, stackPair, "move");
    expect(res.box.y).toBe(350); // 330 + 20
    expect(res.gaps).toEqual([
      { axis: "y", from: 270, to: 290, cross: 100 },
      { axis: "y", from: 330, to: 350, cross: 100 },
    ]);
  });

  it("edge snapping still reports an empty gaps array", () => {
    const res = snap({ x: 297, y: 50, w: 100, h: 20 }, [], "move");
    expect(res.gaps).toEqual([]);
  });
});
