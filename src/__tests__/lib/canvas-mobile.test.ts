import { describe, it, expect } from "vitest";
import {
  placementsForMobile,
  MOBILE_INSET_TOP,
  MOBILE_INSET_X,
  MOBILE_CANVAS_WIDTH,
  MOBILE_GAP_Y,
} from "@/lib/canvas-mobile";
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

describe("placementsForMobile", () => {
  it("stacks elements full-width by desktop y order", () => {
    const elements = [el({ id: "b", y: 100, h: 50 }), el({ id: "a", y: 10, h: 40 })];
    const p = placementsForMobile(elements);
    expect(p["a"]).toEqual({
      x: MOBILE_INSET_X,
      y: MOBILE_INSET_TOP,
      w: MOBILE_CANVAS_WIDTH - MOBILE_INSET_X * 2,
      h: 40,
    });
    expect(p["b"].y).toBe(MOBILE_INSET_TOP + 40 + MOBILE_GAP_Y);
  });

  it("per-axis overrides win over auto-reflow", () => {
    const elements = [el({ id: "a", mobile_x: 5, mobile_w: 80 })];
    const p = placementsForMobile(elements);
    expect(p["a"].x).toBe(5);
    expect(p["a"].w).toBe(80);
    expect(p["a"].y).toBe(MOBILE_INSET_TOP); // still auto
  });

  it("keeps a small sticker at its desktop size, centered", () => {
    const elements = [el({ id: "s", type: "sticker", w: 64, h: 64 })];
    const p = placementsForMobile(elements);
    expect(p["s"]).toEqual({
      x: Math.round((MOBILE_CANVAS_WIDTH - 64) / 2),
      y: MOBILE_INSET_TOP,
      w: 64,
      h: 64,
    });
  });

  it("scales a wide image down proportionally instead of stretching it", () => {
    const elements = [el({ id: "i", type: "image", w: 400, h: 300 })];
    const p = placementsForMobile(elements);
    const contentW = MOBILE_CANVAS_WIDTH - MOBILE_INSET_X * 2; // 328
    expect(p["i"].w).toBe(contentW);
    expect(p["i"].h).toBe(Math.round((300 * contentW) / 400)); // aspect preserved
    expect(p["i"].x).toBe(MOBILE_INSET_X);
  });

  it("scales shapes and regions proportionally too", () => {
    const elements = [el({ id: "r", type: "region", w: 520, h: 320 })];
    const p = placementsForMobile(elements);
    const contentW = MOBILE_CANVAS_WIDTH - MOBILE_INSET_X * 2;
    expect(p["r"].w).toBe(contentW);
    expect(p["r"].h).toBe(Math.round((320 * contentW) / 520));
  });

  it("stacks using the scaled height of visual elements", () => {
    const contentW = MOBILE_CANVAS_WIDTH - MOBILE_INSET_X * 2;
    const elements = [
      el({ id: "i", type: "image", y: 0, w: 400, h: 300 }),
      el({ id: "t", type: "text", y: 100, h: 40 }),
    ];
    const p = placementsForMobile(elements);
    const scaledH = Math.round((300 * contentW) / 400);
    expect(p["t"].y).toBe(MOBILE_INSET_TOP + scaledH + MOBILE_GAP_Y);
  });

  it("overrides still win for visual elements", () => {
    const elements = [el({ id: "s", type: "sticker", w: 64, h: 64, mobile_x: 10, mobile_w: 200 })];
    const p = placementsForMobile(elements);
    expect(p["s"].x).toBe(10);
    expect(p["s"].w).toBe(200);
    expect(p["s"].h).toBe(64); // h not overridden → auto (unscaled, fits)
  });

  it("returns the cached result for the same elements array (identity)", () => {
    const elements = [el({ id: "a" }), el({ id: "b", y: 50 })];
    const first = placementsForMobile(elements);
    const second = placementsForMobile(elements);
    expect(second).toBe(first); // same object — editor calls this many times per frame
  });

  it("recomputes for a new array instance", () => {
    const elements = [el({ id: "a" })];
    const first = placementsForMobile(elements);
    const updated = [...elements.slice(0, 0), { ...elements[0], y: 99 }];
    const second = placementsForMobile(updated);
    expect(second).not.toBe(first);
    expect(second["a"].y).toBe(MOBILE_INSET_TOP);
  });
});
