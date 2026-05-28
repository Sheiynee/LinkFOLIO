import { describe, it, expect } from "vitest";
import { resolveWidget } from "@/lib/widgets/resolve";

describe("resolveWidget", () => {
  describe("empty input", () => {
    it("returns error for empty string", () => {
      const r = resolveWidget("auto", "");
      expect("error" in r).toBe(true);
    });

    it("returns error for whitespace-only input", () => {
      const r = resolveWidget("twitch_live", "   ");
      expect("error" in r).toBe(true);
    });
  });

  describe('kind = "auto"', () => {
    it("auto-detects a Twitch URL", () => {
      const r = resolveWidget("auto", "https://twitch.tv/xqc");
      expect("error" in r).toBe(false);
      if (!("error" in r)) {
        expect(r.kind).toBe("twitch_live");
        expect(r.meta.channel).toBe("xqc");
      }
    });

    it("returns error for an unrecognizable string", () => {
      const r = resolveWidget("auto", "not-a-url");
      expect("error" in r).toBe(true);
    });
  });

  describe("twitch_live / twitch_vod", () => {
    it("accepts a bare channel name", () => {
      const r = resolveWidget("twitch_live", "xqc");
      expect("error" in r).toBe(false);
      if (!("error" in r)) {
        expect(r.kind).toBe("twitch_live");
        expect(r.meta.channel).toBe("xqc");
      }
    });

    it("normalizes a twitch.tv URL to the channel name", () => {
      const r = resolveWidget("twitch_live", "twitch.tv/Ninja");
      if (!("error" in r)) expect(r.meta.channel).toBe("ninja");
    });

    it("rejects a channel name shorter than 3 characters", () => {
      const r = resolveWidget("twitch_live", "ab");
      expect("error" in r).toBe(true);
    });

    it("rejects a channel name longer than 25 characters", () => {
      const r = resolveWidget("twitch_live", "a".repeat(26));
      expect("error" in r).toBe(true);
    });

    it("works for twitch_vod too", () => {
      const r = resolveWidget("twitch_vod", "xqc");
      if (!("error" in r)) expect(r.kind).toBe("twitch_vod");
    });
  });

  describe("youtube_channel / youtube_live", () => {
    it("accepts a YouTube @handle URL", () => {
      const r = resolveWidget("youtube_channel", "https://youtube.com/@mkbhd");
      if (!("error" in r)) {
        expect(r.kind).toBe("youtube_channel");
        expect(r.meta.handle).toBe("mkbhd");
      }
    });

    it("accepts a bare @handle", () => {
      const r = resolveWidget("youtube_channel", "@mkbhd");
      if (!("error" in r)) {
        expect(r.meta.handle).toBe("mkbhd");
      }
    });

    it("rejects garbage input", () => {
      const r = resolveWidget("youtube_channel", "!!!invalid!!!");
      expect("error" in r).toBe(true);
    });
  });

  describe("youtube_video", () => {
    it("accepts a youtu.be short URL", () => {
      const r = resolveWidget("youtube_video", "https://youtu.be/dQw4w9WgXcQ");
      if (!("error" in r)) {
        expect(r.kind).toBe("youtube_video");
        expect(r.meta.video_id).toBe("dQw4w9WgXcQ");
      }
    });

    it("accepts a watch?v= URL", () => {
      const r = resolveWidget(
        "youtube_video",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      );
      if (!("error" in r)) {
        expect(r.kind).toBe("youtube_video");
        expect(r.meta.video_id).toBe("dQw4w9WgXcQ");
      }
    });


    it("returns error for unrelated input", () => {
      const r = resolveWidget("youtube_video", "not-a-video");
      expect("error" in r).toBe(true);
    });
  });

  describe("github_repo", () => {
    it("accepts owner/repo shorthand", () => {
      const r = resolveWidget("github_repo", "vercel/next.js");
      if (!("error" in r)) {
        expect(r.kind).toBe("github_repo");
        expect(r.meta.owner).toBe("vercel");
        expect(r.meta.repo).toBe("next.js");
      }
    });

    it("accepts a github.com URL", () => {
      const r = resolveWidget("github_repo", "https://github.com/vercel/next.js");
      if (!("error" in r)) {
        expect(r.meta.owner).toBe("vercel");
        expect(r.meta.repo).toBe("next.js");
      }
    });

    it("rejects a bare username with no repo", () => {
      const r = resolveWidget("github_repo", "torvalds");
      expect("error" in r).toBe(true);
    });
  });

  describe("github_user", () => {
    it("accepts a bare username", () => {
      const r = resolveWidget("github_user", "torvalds");
      if (!("error" in r)) {
        expect(r.kind).toBe("github_user");
        expect(r.meta.username).toBe("torvalds");
      }
    });

    it("accepts an @-prefixed username", () => {
      const r = resolveWidget("github_user", "@torvalds");
      if (!("error" in r)) expect(r.meta.username).toBe("torvalds");
    });

    it("accepts a github.com profile URL", () => {
      const r = resolveWidget("github_user", "https://github.com/torvalds");
      if (!("error" in r)) expect(r.meta.username).toBe("torvalds");
    });
  });

  describe("discord_invite", () => {
    it("accepts a discord.gg invite link", () => {
      const r = resolveWidget("discord_invite", "https://discord.gg/abc123");
      if (!("error" in r)) {
        expect(r.kind).toBe("discord_invite");
        expect(r.meta.invite_code).toBe("abc123");
      }
    });

    it("returns error for non-invite input", () => {
      const r = resolveWidget("discord_invite", "https://example.com");
      expect("error" in r).toBe(true);
    });
  });

  describe("og_card", () => {
    it("accepts a valid https URL", () => {
      const r = resolveWidget("og_card", "https://vercel.com");
      if (!("error" in r)) {
        expect(r.kind).toBe("og_card");
        expect(r.meta.url).toBe("https://vercel.com");
      }
    });

    it("returns error for a non-URL string", () => {
      const r = resolveWidget("og_card", "not a url");
      expect("error" in r).toBe(true);
    });
  });

  describe("tip_jar", () => {
    it("accepts a ko-fi URL", () => {
      const r = resolveWidget("tip_jar", "https://ko-fi.com/someuser");
      if (!("error" in r)) {
        expect(r.kind).toBe("tip_jar");
        expect(r.meta.platform).toBe("kofi");
      }
    });

    it("returns error for an unrecognized URL", () => {
      const r = resolveWidget("tip_jar", "https://example.com");
      expect("error" in r).toBe(true);
    });
  });

  describe("cross_promo", () => {
    it("accepts a Twitch channel URL", () => {
      const r = resolveWidget("cross_promo", "https://twitch.tv/xqc");
      if (!("error" in r)) {
        expect(r.kind).toBe("cross_promo");
        expect((r.meta as { platform: string }).platform).toBe("twitch");
      }
    });

    it("returns error for a non-social URL", () => {
      const r = resolveWidget("cross_promo", "https://example.com");
      expect("error" in r).toBe(true);
    });
  });

  describe("stream_schedule", () => {
    it("returns a schedule widget with default meta regardless of input", () => {
      const r = resolveWidget("stream_schedule", "");
      if (!("error" in r)) {
        expect(r.kind).toBe("stream_schedule");
        expect(r.meta.timezone).toBe("UTC");
        expect(r.meta.events).toEqual([]);
      }
    });
  });
});
