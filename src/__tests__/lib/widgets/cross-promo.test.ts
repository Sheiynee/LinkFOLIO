import { describe, it, expect } from "vitest";
import { detectCrossPromoFromUrl } from "@/lib/widgets/cross-promo";

describe("detectCrossPromoFromUrl", () => {
  describe("Twitch", () => {
    it("detects a twitch.tv channel URL", () => {
      const r = detectCrossPromoFromUrl("https://twitch.tv/xqc");
      expect(r?.meta.platform).toBe("twitch");
      expect(r?.meta.handle).toBe("xqc");
      expect(r?.meta.url).toBe("https://twitch.tv/xqc");
    });

    it("lowercases the channel handle", () => {
      const r = detectCrossPromoFromUrl("https://twitch.tv/Ninja");
      expect(r?.meta.handle).toBe("ninja");
    });
  });

  describe("YouTube", () => {
    it("detects a youtube.com/@handle URL", () => {
      const r = detectCrossPromoFromUrl("https://youtube.com/@mkbhd");
      expect(r?.meta.platform).toBe("youtube");
      expect(r?.meta.handle).toBe("@mkbhd");
      expect(r?.meta.url).toBe("https://youtube.com/@mkbhd");
    });

    it("includes the title", () => {
      const r = detectCrossPromoFromUrl("https://youtube.com/@mkbhd");
      expect(r?.title).toContain("mkbhd");
    });
  });

  describe("TikTok", () => {
    it("detects a tiktok.com/@handle URL", () => {
      const r = detectCrossPromoFromUrl("https://tiktok.com/@charlidamelio");
      expect(r?.meta.platform).toBe("tiktok");
      expect(r?.meta.handle).toBe("@charlidamelio");
    });
  });

  describe("Spotify artist", () => {
    it("detects an open.spotify.com/artist URL", () => {
      const r = detectCrossPromoFromUrl(
        "https://open.spotify.com/artist/3TVXtAsR1Inumwj472S9r4"
      );
      expect(r?.meta.platform).toBe("spotify");
      expect(r?.meta.handle).toBe("3TVXtAsR1Inumwj472S9r4");
    });
  });

  describe("Instagram", () => {
    it("detects an instagram.com profile URL", () => {
      const r = detectCrossPromoFromUrl("https://instagram.com/nasa");
      expect(r?.meta.platform).toBe("instagram");
      expect(r?.meta.handle).toBe("@nasa");
    });

    it("returns null for reserved path /explore", () => {
      expect(detectCrossPromoFromUrl("https://instagram.com/explore")).toBeNull();
    });

    it("returns null for reserved path /p (post link)", () => {
      expect(detectCrossPromoFromUrl("https://instagram.com/p/Cxyz123")).toBeNull();
    });

    it("returns null for reserved path /reel", () => {
      expect(detectCrossPromoFromUrl("https://instagram.com/reel/Cxyz123")).toBeNull();
    });
  });

  describe("Twitter / X", () => {
    it("detects a twitter.com profile URL", () => {
      const r = detectCrossPromoFromUrl("https://twitter.com/elonmusk");
      expect(r?.meta.platform).toBe("twitter");
      expect(r?.meta.handle).toBe("@elonmusk");
    });

    it("detects an x.com profile URL", () => {
      const r = detectCrossPromoFromUrl("https://x.com/elonmusk");
      expect(r?.meta.platform).toBe("twitter");
      expect(r?.meta.handle).toBe("@elonmusk");
    });

    it("returns null for reserved path /home", () => {
      expect(detectCrossPromoFromUrl("https://twitter.com/home")).toBeNull();
    });

    it("returns null for reserved path /explore", () => {
      expect(detectCrossPromoFromUrl("https://twitter.com/explore")).toBeNull();
    });

    it("returns null for reserved path /notifications", () => {
      expect(detectCrossPromoFromUrl("https://twitter.com/notifications")).toBeNull();
    });
  });

  describe("non-matching input", () => {
    it("returns null for a plain https URL that is not a known platform", () => {
      expect(detectCrossPromoFromUrl("https://example.com")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(detectCrossPromoFromUrl("")).toBeNull();
    });

    it("returns null for a random string", () => {
      expect(detectCrossPromoFromUrl("hello world")).toBeNull();
    });
  });
});
