import { describe, it, expect } from "vitest";
import { paletteFromSeed } from "@/lib/palette";

const HEX_RE = /^#[0-9a-f]{6}$/i;

describe("paletteFromSeed", () => {
  describe("invalid seed", () => {
    it("returns fallback palette for a non-hex string", () => {
      const r = paletteFromSeed("not-a-color");
      expect(r.text_color).toBe("#ffffff");
      // The invalid string is used as the accent passthrough
      expect(r.accent_color).toBe("not-a-color");
    });

    it("returns a gradient background for invalid seed", () => {
      const r = paletteFromSeed("not-a-color");
      expect(r.background.layers).toHaveLength(1);
      expect(r.background.layers[0].type).toBe("gradient");
    });
  });

  describe("valid seed", () => {
    it("returns a palette for a red seed", () => {
      const r = paletteFromSeed("#ff6b6b");
      expect(r.text_color).toBe("#ffffff");
      expect(r.background.layers).toHaveLength(1);
      expect(r.background.layers[0].type).toBe("gradient");
    });

    it("returns a palette for a blue seed", () => {
      const r = paletteFromSeed("#3498db");
      expect(r.text_color).toBe("#ffffff");
    });

    it("returns a palette for a dark seed", () => {
      const r = paletteFromSeed("#1a1a2e");
      expect(r.text_color).toBe("#ffffff");
    });

    it("accent_color is a valid hex string", () => {
      const r = paletteFromSeed("#9b59b6");
      expect(r.accent_color).toMatch(HEX_RE);
    });

    it("muted_color is a valid hex string", () => {
      const r = paletteFromSeed("#1abc9c");
      expect(r.muted_color).toMatch(HEX_RE);
    });
  });

  describe("gradient shape", () => {
    it("has exactly 2 stops", () => {
      const r = paletteFromSeed("#e74c3c");
      const layer = r.background.layers[0] as { stops: Array<{ position: number; color: string }> };
      expect(layer.stops).toHaveLength(2);
    });

    it("stop positions are 0 and 100", () => {
      const r = paletteFromSeed("#e74c3c");
      const layer = r.background.layers[0] as { stops: Array<{ position: number }> };
      expect(layer.stops[0].position).toBe(0);
      expect(layer.stops[1].position).toBe(100);
    });

    it("stop colors are valid hex", () => {
      const r = paletteFromSeed("#e74c3c");
      const layer = r.background.layers[0] as { stops: Array<{ color: string }> };
      expect(layer.stops[0].color).toMatch(HEX_RE);
      expect(layer.stops[1].color).toMatch(HEX_RE);
    });

    it("gradient angle is 135", () => {
      const r = paletteFromSeed("#e74c3c");
      const layer = r.background.layers[0] as { angle: number };
      expect(layer.angle).toBe(135);
    });
  });

  describe("button styles are static", () => {
    it("button_bg is always rgba(255,255,255,0.08)", () => {
      expect(paletteFromSeed("#ff0000").button_bg).toBe("rgba(255,255,255,0.08)");
      expect(paletteFromSeed("#00ff00").button_bg).toBe("rgba(255,255,255,0.08)");
    });

    it("button_text is always #ffffff", () => {
      expect(paletteFromSeed("#ff0000").button_text).toBe("#ffffff");
    });

    it("button_border is always rgba(255,255,255,0.18)", () => {
      expect(paletteFromSeed("#ff0000").button_border).toBe("rgba(255,255,255,0.18)");
    });
  });

  describe("determinism", () => {
    it("produces the same palette for the same seed on repeated calls", () => {
      // background.layers[0].id uses crypto.randomUUID(), so we check everything else
      const a = paletteFromSeed("#3498db");
      const b = paletteFromSeed("#3498db");
      expect(a.text_color).toBe(b.text_color);
      expect(a.muted_color).toBe(b.muted_color);
      expect(a.accent_color).toBe(b.accent_color);
      const la = a.background.layers[0] as { stops: Array<{ color: string; position: number }>; angle: number };
      const lb = b.background.layers[0] as { stops: Array<{ color: string; position: number }>; angle: number };
      expect(la.stops).toEqual(lb.stops);
      expect(la.angle).toEqual(lb.angle);
    });
  });
});
