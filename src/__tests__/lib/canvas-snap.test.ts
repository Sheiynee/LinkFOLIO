import { describe, it, expect } from "vitest";
import { snap } from "@/lib/canvas-snap";

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
