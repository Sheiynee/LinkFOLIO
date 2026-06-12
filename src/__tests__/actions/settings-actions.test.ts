import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/reserved-usernames", () => ({
  isReservedUsername: vi.fn().mockResolvedValue(false),
  isLocallyReserved: vi.fn().mockReturnValue(false),
}));
vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/image-magic", () => ({
  validateImageFile: vi.fn().mockResolvedValue({ ok: true, ext: "jpg" }),
}));
vi.mock("@/lib/storage-quota", () => ({
  ensureStorageHeadroom: vi.fn().mockResolvedValue({ ok: true }),
  addStorageUsage: vi.fn().mockResolvedValue(undefined),
  cleanupReplacedUploads: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  RL_UPLOAD: "upload",
}));

import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isReservedUsername } from "@/lib/reserved-usernames";
import { logAuditEvent } from "@/lib/audit-log";
import { updateProfile } from "@/app/dashboard/settings/actions";
import { chain, mockDb } from "../helpers/supabase-mock";

const mockAuth = vi.mocked(auth);
const mockCreateAdminClient = vi.mocked(createAdminClient);

const USER_ID = "user-abc";
const SESSION = { user: { id: USER_ID } };

function fd(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

describe("updateProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isReservedUsername).mockResolvedValue(false);
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    expect(await updateProfile(fd({ username: "alice" }))).toEqual({
      error: "Not authenticated",
    });
  });

  describe("username format validation", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("rejects username shorter than 3 chars", async () => {
      expect(await updateProfile(fd({ username: "ab" }))).toEqual({
        error: "Username must be 3-30 chars: a-z, 0-9, _ or -",
      });
    });

    it("rejects username longer than 30 chars", async () => {
      expect(await updateProfile(fd({ username: "a".repeat(31) }))).toEqual({
        error: "Username must be 3-30 chars: a-z, 0-9, _ or -",
      });
    });

    it("rejects username with spaces", async () => {
      expect(await updateProfile(fd({ username: "alice bob" }))).toEqual({
        error: "Username must be 3-30 chars: a-z, 0-9, _ or -",
      });
    });

    it("rejects username with uppercase letters (after lowercasing)", async () => {
      // The action lowercases first, then validates — uppercase letters become
      // lowercase and pass the regex. Test that a symbol is still rejected.
      expect(await updateProfile(fd({ username: "alice!" }))).toEqual({
        error: "Username must be 3-30 chars: a-z, 0-9, _ or -",
      });
    });

    it("accepts a username with letters, digits, underscores, and hyphens", async () => {
      mockCreateAdminClient.mockReturnValue(
        mockDb(
          chain({ data: null, error: null }), // duplicate check — not taken
          chain({ data: null, error: null })  // update
        )
      );
      expect(await updateProfile(fd({ username: "alice_42-ok" }))).toEqual({
        ok: true,
        username: "alice_42-ok",
      });
    });
  });

  describe("reserved username", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("rejects a reserved username", async () => {
      vi.mocked(isReservedUsername).mockResolvedValue(true);
      expect(await updateProfile(fd({ username: "admin" }))).toEqual({
        error: "That username is reserved",
      });
    });

    it("logs an audit event on reserved username attempt", async () => {
      vi.mocked(isReservedUsername).mockResolvedValue(true);
      await updateProfile(fd({ username: "admin" }));
      expect(vi.mocked(logAuditEvent)).toHaveBeenCalledWith(
        "username.reserved_attempt",
        expect.objectContaining({ userId: USER_ID, detail: { attempted: "admin" } })
      );
    });
  });

  describe("duplicate username", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("rejects a username already taken by another user", async () => {
      mockCreateAdminClient.mockReturnValue(
        mockDb(chain({ data: { id: "other-user" }, error: null }))
      );
      expect(await updateProfile(fd({ username: "bob" }))).toEqual({
        error: "Username already taken",
      });
    });
  });

  describe("successful update", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("returns ok and the chosen username", async () => {
      mockCreateAdminClient.mockReturnValue(
        mockDb(
          chain({ data: null, error: null }),
          chain({ data: null, error: null })
        )
      );
      expect(await updateProfile(fd({ username: "alice" }))).toEqual({
        ok: true,
        username: "alice",
      });
    });

    it("lowercases the username before saving", async () => {
      const updateChain = chain({ data: null, error: null });
      mockCreateAdminClient.mockReturnValue(
        mockDb(chain({ data: null, error: null }), updateChain)
      );
      await updateProfile(fd({ username: "ALICE" }));
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ username: "alice" })
      );
    });

    it("saves display_name and bio from the form data", async () => {
      const updateChain = chain({ data: null, error: null });
      mockCreateAdminClient.mockReturnValue(
        mockDb(chain({ data: null, error: null }), updateChain)
      );
      await updateProfile(fd({ username: "alice", display_name: "Alice Smith", bio: "Hi!" }));
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ display_name: "Alice Smith", bio: "Hi!" })
      );
    });

    it("stores null for empty display_name", async () => {
      const updateChain = chain({ data: null, error: null });
      mockCreateAdminClient.mockReturnValue(
        mockDb(chain({ data: null, error: null }), updateChain)
      );
      await updateProfile(fd({ username: "alice", display_name: "" }));
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ display_name: null })
      );
    });
  });
});
