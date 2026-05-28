import { describe, it, expect } from "vitest";
import {
  arrange,
  arrangeGrid,
  arrangeAsymmetric,
  arrangeHero,
  type ArrangePatch,
} from "@/lib/magic-arrange";
import type { Element } from "@/lib/elements";
import { CANVAS_WIDTH } from "@/lib/elements";

// Constants mirrored from magic-arrange.ts
const HEADER_INSET = 220;
const SIDE_INSET = 24;
const GAP = 16;

function el(
  id: string,
  w = 200,
  h = 100,
  type: Element["type"] = "link"
): Element {
  return {
    id,
    type,
    title: null,
    url: null,
    content: null,
    x: 0,
    y: 0,
    w,
    h,
    rotation: 0,
    z: 0,
  };
}

describe("arrangeGrid", () => {
  it("returns [] for empty input", () => {
    expect(arrangeGrid([])).toEqual([]);
  });

  it("uses single column when fewer than 4 elements", () => {
    const patches = arrangeGrid([el("a"), el("b"), el("c")]);
    const colW = Math.floor((CANVAS_WIDTH - SIDE_INSET * 2) / 1);
    expect(patches.every((p) => p.w === colW)).toBe(true);
  });

  it("uses 2 columns for 4+ elements", () => {
    const patches = arrangeGrid([el("a"), el("b"), el("c"), el("d")]);
    const colW = Math.floor((CANVAS_WIDTH - SIDE_INSET * 2 - GAP) / 2);
    expect(patches.every((p) => p.w === colW)).toBe(true);
  });

  it("starts at HEADER_INSET", () => {
    const patches = arrangeGrid([el("a"), el("b")]);
    expect(Math.min(...patches.map((p) => p.y))).toBe(HEADER_INSET);
  });

  it("first element is at SIDE_INSET x", () => {
    const [first] = arrangeGrid([el("a"), el("b")]);
    expect(first.x).toBe(SIDE_INSET);
  });

  it("returns one patch per element", () => {
    const elements = [el("a"), el("b"), el("c"), el("d")];
    expect(arrangeGrid(elements)).toHaveLength(4);
  });

  it("patch ids match element ids", () => {
    const elements = [el("x1"), el("x2"), el("x3")];
    const patches = arrangeGrid(elements);
    const patchIds = new Set(patches.map((p) => p.id));
    expect(patchIds).toEqual(new Set(["x1", "x2", "x3"]));
  });

  it("excludes regions from the arrangement", () => {
    const elements = [el("a"), el("b", 200, 100, "region"), el("c")];
    const patches = arrangeGrid(elements);
    expect(patches.find((p) => p.id === "b")).toBeUndefined();
    expect(patches).toHaveLength(2);
  });

  it("preserves aspect ratio (h = round(colW / ratio))", () => {
    // ratio 2:1 element (w=200, h=100)
    const patches = arrangeGrid([el("a", 200, 100)]);
    const colW = Math.floor((CANVAS_WIDTH - SIDE_INSET * 2) / 1);
    expect(patches[0].h).toBe(Math.round(colW / 2));
  });

  it("rows stack below each other with GAP", () => {
    // 2 elements in 1-column mode → 1 row each
    const patches = arrangeGrid([el("a", 200, 100), el("b", 200, 100)]);
    const colW = Math.floor((CANVAS_WIDTH - SIDE_INSET * 2) / 1);
    const rowH = Math.round(colW / 2);
    expect(patches[0].y).toBe(HEADER_INSET);
    expect(patches[1].y).toBe(HEADER_INSET + rowH + GAP);
  });
});

describe("arrangeAsymmetric", () => {
  it("returns [] for empty input", () => {
    expect(arrangeAsymmetric([])).toEqual([]);
  });

  it("returns one patch per non-region element", () => {
    const elements = [el("a"), el("b"), el("c")];
    expect(arrangeAsymmetric(elements)).toHaveLength(3);
  });

  it("alternates x offsets (left / right sides)", () => {
    const phi = 0.618;
    const baseW = Math.round((CANVAS_WIDTH - SIDE_INSET * 2) * phi);
    const leftX = SIDE_INSET;
    const rightX = CANVAS_WIDTH - SIDE_INSET - baseW;

    const patches = arrangeAsymmetric([el("a"), el("b"), el("c"), el("d")]);
    expect(patches[0].x).toBe(leftX);   // i=0 even → left
    expect(patches[1].x).toBe(rightX);  // i=1 odd  → right
    expect(patches[2].x).toBe(leftX);   // i=2 even → left
    expect(patches[3].x).toBe(rightX);  // i=3 odd  → right
  });

  it("starts at HEADER_INSET", () => {
    const [first] = arrangeAsymmetric([el("a")]);
    expect(first.y).toBe(HEADER_INSET);
  });
});

describe("arrangeHero", () => {
  it("returns [] for empty input", () => {
    expect(arrangeHero([])).toEqual([]);
  });

  it("first element spans full content width", () => {
    const patches = arrangeHero([el("hero"), el("a"), el("b")]);
    const heroW = CANVAS_WIDTH - SIDE_INSET * 2;
    expect(patches[0].w).toBe(heroW);
  });

  it("hero is positioned at HEADER_INSET and SIDE_INSET", () => {
    const [hero] = arrangeHero([el("hero")]);
    expect(hero.x).toBe(SIDE_INSET);
    expect(hero.y).toBe(HEADER_INSET);
  });

  it("rest of elements come after the hero with a gap", () => {
    const patches = arrangeHero([el("hero", 200, 100), el("a"), el("b")]);
    const heroW = CANVAS_WIDTH - SIDE_INSET * 2;
    const heroH = Math.max(120, Math.round(heroW / 2)); // ratio 2:1
    const gridStartY = HEADER_INSET + heroH + GAP;
    const gridPatches = patches.slice(1);
    expect(Math.min(...gridPatches.map((p) => p.y))).toBe(gridStartY);
  });

  it("returns just the hero when only one element provided", () => {
    const patches = arrangeHero([el("hero")]);
    expect(patches).toHaveLength(1);
    expect(patches[0].id).toBe("hero");
  });

  it("grid items have correct width (2 columns)", () => {
    const patches = arrangeHero([el("hero"), el("a"), el("b")]);
    const colW = Math.floor((CANVAS_WIDTH - SIDE_INSET * 2 - GAP) / 2);
    patches.slice(1).forEach((p) => {
      expect(p.w).toBe(colW);
    });
  });
});

describe("arrange dispatcher", () => {
  it("routes 'grid' to arrangeGrid", () => {
    const direct = arrangeGrid([el("a"), el("b")]);
    const dispatched = arrange("grid", [el("a"), el("b")]);
    expect(dispatched).toEqual(direct);
  });

  it("routes 'asymmetric' to arrangeAsymmetric", () => {
    const direct = arrangeAsymmetric([el("a"), el("b")]);
    const dispatched = arrange("asymmetric", [el("a"), el("b")]);
    expect(dispatched).toEqual(direct);
  });

  it("routes 'hero' to arrangeHero", () => {
    const direct = arrangeHero([el("a"), el("b")]);
    const dispatched = arrange("hero", [el("a"), el("b")]);
    expect(dispatched).toEqual(direct);
  });
});
