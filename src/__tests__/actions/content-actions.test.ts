import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/twitch-eventsub", () => ({
  ensureChannelSubscriptions: vi.fn().mockResolvedValue(undefined),
}));

import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureChannelSubscriptions } from "@/lib/twitch-eventsub";
import { createBlock, createWidgetBlock } from "@/app/dashboard/content/actions";
import { chain, mockDb } from "../helpers/supabase-mock";

const mockAuth = vi.mocked(auth);
const mockCreateAdminClient = vi.mocked(createAdminClient);

const USER_ID = "user-abc";
const SESSION = { user: { id: USER_ID } };

// Three DB calls in a successful createBlock: max position, insert, revalidation profile.
function dbForCreate(newId = "block-1", existingPosition: number | null = null) {
  return mockDb(
    chain({ data: existingPosition !== null ? { position: existingPosition } : null, error: null }),
    chain({ data: { id: newId }, error: null }),
    chain({ data: { username: "alice" }, error: null })
  );
}

describe("createBlock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    expect(await createBlock({ type: "link", title: "T", url: "https://x.com" })).toEqual({
      error: "Not authenticated",
    });
  });

  describe("link blocks", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("rejects empty title", async () => {
      expect(await createBlock({ type: "link", title: "", url: "https://x.com" })).toEqual({
        error: "Title and URL are required",
      });
    });

    it("rejects empty URL", async () => {
      expect(await createBlock({ type: "link", title: "T", url: "" })).toEqual({
        error: "Title and URL are required",
      });
    });

    it("rejects private-IP URL (SSRF guard)", async () => {
      expect(await createBlock({ type: "link", title: "T", url: "http://192.168.1.1" })).toEqual({
        error: "Invalid URL",
      });
    });

    it("rejects javascript: URL (XSS guard)", async () => {
      expect(await createBlock({ type: "link", title: "T", url: "javascript:alert(1)" })).toEqual({
        error: "Invalid URL",
      });
    });

    it("successfully creates a link block and returns its id", async () => {
      mockCreateAdminClient.mockReturnValue(dbForCreate("new-id"));
      expect(await createBlock({ type: "link", title: "My Site", url: "https://example.com" })).toEqual({
        ok: true,
        id: "new-id",
      });
    });

    it("normalises bare domain to https://", async () => {
      mockCreateAdminClient.mockReturnValue(dbForCreate("new-id"));
      const result = await createBlock({ type: "link", title: "T", url: "example.com" });
      expect(result).toEqual({ ok: true, id: "new-id" });
    });

    it("assigns position = maxPosition + 1 when blocks exist", async () => {
      const insertChain = chain({ data: { id: "x" }, error: null });
      mockCreateAdminClient.mockReturnValue(
        mockDb(
          chain({ data: { position: 4 }, error: null }),
          insertChain,
          chain({ data: { username: "alice" }, error: null })
        )
      );
      await createBlock({ type: "link", title: "T", url: "https://example.com" });
      expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({ position: 5 }));
    });

    it("assigns position 0 when no blocks exist yet", async () => {
      const insertChain = chain({ data: { id: "x" }, error: null });
      mockCreateAdminClient.mockReturnValue(
        mockDb(
          chain({ data: null, error: null }),
          insertChain,
          chain({ data: { username: "alice" }, error: null })
        )
      );
      await createBlock({ type: "link", title: "T", url: "https://example.com" });
      expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({ position: 0 }));
    });

    it("returns DB error message when insert fails", async () => {
      mockCreateAdminClient.mockReturnValue(
        mockDb(
          chain({ data: null, error: null }),
          chain({ data: null, error: { message: "unique violation" } }),
          chain({ data: { username: "alice" }, error: null })
        )
      );
      expect(await createBlock({ type: "link", title: "T", url: "https://example.com" })).toEqual({
        error: "unique violation",
      });
    });
  });

  describe("text / heading blocks", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("rejects empty content", async () => {
      expect(await createBlock({ type: "text", content: "" })).toEqual({
        error: "Content is required",
      });
    });

    it("rejects whitespace-only content", async () => {
      expect(await createBlock({ type: "text", content: "   " })).toEqual({
        error: "Content is required",
      });
    });

    it("successfully creates a text block", async () => {
      mockCreateAdminClient.mockReturnValue(dbForCreate("text-1"));
      expect(await createBlock({ type: "text", content: "Hello world" })).toEqual({
        ok: true,
        id: "text-1",
      });
    });

    it("successfully creates a heading block", async () => {
      mockCreateAdminClient.mockReturnValue(dbForCreate("heading-1"));
      expect(await createBlock({ type: "heading", content: "My Section" })).toEqual({
        ok: true,
        id: "heading-1",
      });
    });
  });
});

describe("createWidgetBlock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    expect(await createWidgetBlock({ kind: "twitch_live", input: "xqc" })).toEqual({
      error: "Not authenticated",
    });
  });

  describe("resolve errors", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("returns error when channel name is too short for twitch_live", async () => {
      const result = await createWidgetBlock({ kind: "twitch_live", input: "ab" });
      expect("error" in result).toBe(true);
    });

    it("returns error when auto-detection finds no matching platform", async () => {
      const result = await createWidgetBlock({ kind: "auto", input: "not-a-url" });
      expect("error" in result).toBe(true);
    });
  });

  describe("success", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    function dbForWidget(id = "widget-1") {
      return mockDb(
        chain({ data: null, error: null }),
        chain({ data: { id }, error: null }),
        chain({ data: { username: "alice" }, error: null })
      );
    }

    it("creates a twitch_live widget and returns its id and kind", async () => {
      mockCreateAdminClient.mockReturnValue(dbForWidget("w1"));
      const result = await createWidgetBlock({ kind: "twitch_live", input: "xqc" });
      expect(result).toMatchObject({ ok: true, id: "w1", kind: "twitch_live" });
    });

    it("calls ensureChannelSubscriptions with the channel name for twitch_live", async () => {
      mockCreateAdminClient.mockReturnValue(dbForWidget());
      await createWidgetBlock({ kind: "twitch_live", input: "xqc" });
      expect(vi.mocked(ensureChannelSubscriptions)).toHaveBeenCalledWith("xqc");
    });

    it("does NOT call ensureChannelSubscriptions for non-Twitch widgets", async () => {
      mockCreateAdminClient.mockReturnValue(dbForWidget());
      await createWidgetBlock({ kind: "github_user", input: "torvalds" });
      expect(vi.mocked(ensureChannelSubscriptions)).not.toHaveBeenCalled();
    });

    it("resolves and stores the correct meta for a GitHub user widget", async () => {
      const insertChain = chain({ data: { id: "w2" }, error: null });
      mockCreateAdminClient.mockReturnValue(
        mockDb(
          chain({ data: null, error: null }),
          insertChain,
          chain({ data: { username: "alice" }, error: null })
        )
      );
      await createWidgetBlock({ kind: "github_user", input: "torvalds" });
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ widget_kind: "github_user", meta: { username: "torvalds" } })
      );
    });

    it("auto-detects twitch_live from a twitch.tv URL", async () => {
      mockCreateAdminClient.mockReturnValue(dbForWidget("w3"));
      const result = await createWidgetBlock({ kind: "auto", input: "https://twitch.tv/ninja" });
      expect(result).toMatchObject({ ok: true, kind: "twitch_live" });
    });
  });
});
