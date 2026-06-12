import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/widgets/twitch", () => ({ fetchHelixStream: vi.fn().mockResolvedValue(null) }));

import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit-log";
import { fetchHelixStream } from "@/lib/widgets/twitch";
import { POST } from "@/app/api/webhooks/twitch/route";
import { chain, mockDb } from "../helpers/supabase-mock";

const mockCreateAdminClient = vi.mocked(createAdminClient);
const TEST_SECRET = "test-eventsub-secret-32-chars-ok";

// ─── helpers ───────────────────────────────────────────────────────────────

function sign(msgId: string, timestamp: string, body: string): string {
  return "sha256=" + createHmac("sha256", TEST_SECRET).update(msgId + timestamp + body).digest("hex");
}

function makeReq(
  msgType: string,
  body: string,
  opts: { badSig?: boolean; staleTimestamp?: boolean } = {}
): Request {
  const msgId = "msg-" + Math.random().toString(36).slice(2);
  const timestamp = opts.staleTimestamp
    ? new Date(Date.now() - 11 * 60 * 1000).toISOString() // 11 min ago → stale
    : new Date().toISOString();
  const sig = opts.badSig
    ? "sha256=" + "0".repeat(64) // valid length, wrong value → fails timingSafeEqual
    : sign(msgId, timestamp, body);

  return new Request("http://localhost/api/webhooks/twitch", {
    method: "POST",
    headers: {
      "twitch-eventsub-message-type": msgType,
      "twitch-eventsub-message-id": msgId,
      "twitch-eventsub-message-timestamp": timestamp,
      "twitch-eventsub-message-signature": sig,
      "content-type": "application/json",
    },
    body,
  });
}

// ─── tests ─────────────────────────────────────────────────────────────────

describe("POST /api/webhooks/twitch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TWITCH_EVENTSUB_SECRET", TEST_SECRET);
    mockCreateAdminClient.mockReturnValue(
      mockDb(chain({ data: null, error: null }), chain({ data: null, error: null }))
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("configuration", () => {
    it("returns 500 when TWITCH_EVENTSUB_SECRET is not set", async () => {
      vi.stubEnv("TWITCH_EVENTSUB_SECRET", "");
      const res = await POST(makeReq("notification", "{}") as never);
      expect(res.status).toBe(500);
    });
  });

  describe("HMAC signature verification", () => {
    it("returns 403 for a bad signature", async () => {
      const res = await POST(makeReq("notification", "{}", { badSig: true }) as never);
      expect(res.status).toBe(403);
    });

    it("logs an audit event on signature failure", async () => {
      await POST(makeReq("notification", "{}", { badSig: true }) as never);
      expect(vi.mocked(logAuditEvent)).toHaveBeenCalledWith(
        "twitch.webhook_rejected",
        expect.objectContaining({ detail: { reason: "bad_signature" } })
      );
    });

    it("accepts a request with a valid signature", async () => {
      const body = JSON.stringify({ subscription: { type: "stream.online" }, event: {} });
      const res = await POST(makeReq("notification", body) as never);
      expect(res.status).toBe(200);
    });
  });

  describe("replay guard", () => {
    it("returns 410 for a message timestamped >10 minutes ago", async () => {
      const body = JSON.stringify({});
      const res = await POST(makeReq("notification", body, { staleTimestamp: true }) as never);
      expect(res.status).toBe(410);
    });

    it("accepts a message with a fresh timestamp", async () => {
      const body = JSON.stringify({ subscription: { type: "stream.online" }, event: {} });
      const res = await POST(makeReq("notification", body) as never);
      expect(res.status).toBe(200);
    });
  });

  describe("challenge verification", () => {
    it("returns 200 with the challenge text", async () => {
      const body = JSON.stringify({ challenge: "abc-challenge-xyz" });
      const res = await POST(
        makeReq("webhook_callback_verification", body) as never
      );
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("abc-challenge-xyz");
    });

    it("returns 400 when challenge field is missing", async () => {
      const body = JSON.stringify({});
      const res = await POST(
        makeReq("webhook_callback_verification", body) as never
      );
      expect(res.status).toBe(400);
    });
  });

  describe("stream.online notification", () => {
    it("upserts creator_live_status with is_live=true", async () => {
      const upsertChain = chain({ data: null, error: null });
      mockCreateAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(upsertChain) } as never);

      const body = JSON.stringify({
        subscription: { type: "stream.online" },
        event: {
          broadcaster_user_login: "TestStreamer",
          broadcaster_user_id: "12345",
          title: "Playing Fortnite",
          category_name: "Fortnite",
        },
      });
      const res = await POST(makeReq("notification", body) as never);
      expect(res.status).toBe(200);
      expect(upsertChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ channel: "teststreamer", is_live: true, broadcaster_id: "12345" })
      );
    });

    it("lowercases the channel login before upserting", async () => {
      const upsertChain = chain({ data: null, error: null });
      mockCreateAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(upsertChain) } as never);

      const body = JSON.stringify({
        subscription: { type: "stream.online" },
        event: { broadcaster_user_login: "UPPERCASE", broadcaster_user_id: "1" },
      });
      await POST(makeReq("notification", body) as never);
      expect(upsertChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ channel: "uppercase" })
      );
    });
  });

  describe("stream.offline notification", () => {
    it("upserts creator_live_status with is_live=false", async () => {
      const upsertChain = chain({ data: null, error: null });
      mockCreateAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(upsertChain) } as never);

      const body = JSON.stringify({
        subscription: { type: "stream.offline" },
        event: { broadcaster_user_login: "streamer", broadcaster_user_id: "99" },
      });
      const res = await POST(makeReq("notification", body) as never);
      expect(res.status).toBe(200);
      expect(upsertChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ channel: "streamer", is_live: false })
      );
    });
  });

  describe("message-id dedupe", () => {
    it("acks a retried message id without re-processing", async () => {
      const dedupeChain = chain({ data: null, error: { code: "23505", message: "duplicate key" } });
      const upsertChain = chain({ data: null, error: null });
      mockCreateAdminClient.mockReturnValue({
        from: vi.fn((table: string) =>
          table === "twitch_webhook_messages" ? dedupeChain : upsertChain
        ),
      } as never);

      const body = JSON.stringify({
        subscription: { type: "stream.online" },
        event: { broadcaster_user_login: "streamer", broadcaster_user_id: "1" },
      });
      const res = await POST(makeReq("notification", body) as never);
      expect(res.status).toBe(200);
      expect(upsertChain.upsert).not.toHaveBeenCalled();
    });

    it("records the message id on first delivery", async () => {
      const dedupeChain = chain({ data: null, error: null });
      const upsertChain = chain({ data: null, error: null });
      mockCreateAdminClient.mockReturnValue({
        from: vi.fn((table: string) =>
          table === "twitch_webhook_messages" ? dedupeChain : upsertChain
        ),
      } as never);

      const body = JSON.stringify({
        subscription: { type: "stream.online" },
        event: { broadcaster_user_login: "streamer", broadcaster_user_id: "1" },
      });
      await POST(makeReq("notification", body) as never);
      expect(dedupeChain.insert).toHaveBeenCalledWith({ id: expect.stringMatching(/^msg-/) });
      expect(upsertChain.upsert).toHaveBeenCalled();
    });
  });

  describe("Helix backfill on stream.online", () => {
    it("writes the live title/game/viewers from Helix", async () => {
      vi.mocked(fetchHelixStream).mockResolvedValueOnce({
        title: "Speedrun!",
        game_name: "Celeste",
        viewer_count: 321,
        started_at: "2026-06-13T10:00:00Z",
      });
      const upsertChain = chain({ data: null, error: null });
      mockCreateAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(upsertChain) } as never);

      const body = JSON.stringify({
        subscription: { type: "stream.online" },
        event: { broadcaster_user_login: "streamer", broadcaster_user_id: "1" },
      });
      await POST(makeReq("notification", body) as never);
      expect(upsertChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          stream_title: "Speedrun!",
          game_name: "Celeste",
          viewer_count: 321,
          started_at: "2026-06-13T10:00:00Z",
        })
      );
    });

    it("writes nulls (not empty strings) when Helix has no data yet", async () => {
      vi.mocked(fetchHelixStream).mockResolvedValueOnce(null);
      const upsertChain = chain({ data: null, error: null });
      mockCreateAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(upsertChain) } as never);

      const body = JSON.stringify({
        subscription: { type: "stream.online" },
        event: { broadcaster_user_login: "streamer", broadcaster_user_id: "1" },
      });
      await POST(makeReq("notification", body) as never);
      expect(upsertChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ stream_title: null, game_name: null })
      );
    });
  });

  describe("invalid body", () => {
    it("returns 400 for malformed JSON", async () => {
      const res = await POST(makeReq("notification", "not-json") as never);
      expect(res.status).toBe(400);
    });
  });
});
