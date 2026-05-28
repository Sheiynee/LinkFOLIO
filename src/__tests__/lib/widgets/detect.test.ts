import { describe, it, expect } from "vitest";
import { detectWidgetFromUrl } from "@/lib/widgets/detect";

describe("detectWidgetFromUrl", () => {
  it("returns null for empty string", () => {
    expect(detectWidgetFromUrl("")).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    expect(detectWidgetFromUrl("   ")).toBeNull();
  });

  it("returns null for an unrecognizable string", () => {
    expect(detectWidgetFromUrl("hello world")).toBeNull();
  });

  describe("Twitch → twitch_live", () => {
    it("detects a full twitch.tv URL", () => {
      const r = detectWidgetFromUrl("https://twitch.tv/xqc");
      expect(r?.kind).toBe("twitch_live");
      expect(r?.meta).toEqual({ channel: "xqc" });
    });

    it("label includes the channel name", () => {
      const r = detectWidgetFromUrl("https://twitch.tv/ninja");
      expect(r?.label).toContain("ninja");
    });
  });

  describe("Spotify → spotify_embed", () => {
    it("detects a Spotify track URL", () => {
      const r = detectWidgetFromUrl(
        "https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh"
      );
      expect(r?.kind).toBe("spotify_embed");
      expect(r?.meta.type).toBe("track");
      expect(r?.meta.id).toBe("4iV5W9uYEdYUVa79Axb7Rh");
    });

    it("detects a Spotify playlist URL", () => {
      const r = detectWidgetFromUrl(
        "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
      );
      expect(r?.kind).toBe("spotify_embed");
      expect(r?.meta.type).toBe("playlist");
    });
  });

  describe("TikTok → tiktok_video", () => {
    it("detects a TikTok video URL", () => {
      const r = detectWidgetFromUrl(
        "https://www.tiktok.com/@charli/video/6829267836419610886"
      );
      expect(r?.kind).toBe("tiktok_video");
      expect(r?.meta.username).toBe("charli");
      expect(r?.meta.video_id).toBe("6829267836419610886");
    });
  });

  describe("Ko-fi / tip jar → tip_jar", () => {
    it("detects a ko-fi URL", () => {
      const r = detectWidgetFromUrl("https://ko-fi.com/someuser");
      expect(r?.kind).toBe("tip_jar");
      expect(r?.meta.platform).toBe("kofi");
    });
  });

  describe("Discord → discord_invite", () => {
    it("detects a discord.gg invite link", () => {
      const r = detectWidgetFromUrl("https://discord.gg/abc123");
      expect(r?.kind).toBe("discord_invite");
      expect(r?.meta.invite_code).toBe("abc123");
    });
  });

  describe("GitHub → github_repo / github_user", () => {
    it("detects a github.com repo URL", () => {
      const r = detectWidgetFromUrl("https://github.com/vercel/next.js");
      expect(r?.kind).toBe("github_repo");
      expect(r?.meta.owner).toBe("vercel");
      expect(r?.meta.repo).toBe("next.js");
    });

    it("detects a github.com user profile URL", () => {
      const r = detectWidgetFromUrl("https://github.com/torvalds");
      expect(r?.kind).toBe("github_user");
      expect(r?.meta.username).toBe("torvalds");
    });
  });

  describe("YouTube → youtube_video / youtube_channel", () => {
    it("detects a YouTube video URL (youtu.be)", () => {
      const r = detectWidgetFromUrl("https://youtu.be/dQw4w9WgXcQ");
      expect(r?.kind).toBe("youtube_video");
      expect(r?.meta.video_id).toBe("dQw4w9WgXcQ");
    });

    it("detects a YouTube video URL (watch?v=)", () => {
      const r = detectWidgetFromUrl(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      );
      expect(r?.kind).toBe("youtube_video");
    });

    it("detects a YouTube channel @handle URL", () => {
      const r = detectWidgetFromUrl("https://youtube.com/@mkbhd");
      expect(r?.kind).toBe("youtube_channel");
      expect(r?.meta.handle).toBe("mkbhd");
    });
  });

  describe("generic OG card fallback", () => {
    it("falls back to og_card for any valid https URL", () => {
      const r = detectWidgetFromUrl("https://vercel.com");
      expect(r?.kind).toBe("og_card");
      expect(r?.meta.url).toBe("https://vercel.com");
    });

    it("falls back to og_card for a URL that is not a known platform", () => {
      const r = detectWidgetFromUrl("https://example.com/some/page");
      expect(r?.kind).toBe("og_card");
    });

    it("returns null for http URL that looks invalid", () => {
      // "plaintext" is not a valid URL
      expect(detectWidgetFromUrl("plaintext")).toBeNull();
    });
  });
});
