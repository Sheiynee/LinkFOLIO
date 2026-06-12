import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/email", () => ({
  sendEmailVerification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/storage-quota", () => ({
  subtractStorageUsage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, used: 1, limit: 20, retryAfterSeconds: 0 }),
  RL_AUTH: { scope: "auth", limit: 20, windowSeconds: 60 },
}));

import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmailVerification } from "@/lib/email";
import { requestEmailChange } from "@/app/dashboard/settings/account-actions";
import { chain } from "../helpers/supabase-mock";

const mockAuth = vi.mocked(auth);
const mockCreateAdminClient = vi.mocked(createAdminClient);

const USER_ID = "user-abc";
const SESSION = { user: { id: USER_ID } };

function dbWithRpc(emailExists: boolean, insertError: { message: string } | null = null) {
  const insertChain = chain({ data: null, error: insertError });
  return {
    client: {
      rpc: vi.fn().mockResolvedValue({ data: emailExists, error: null }),
      from: vi.fn().mockReturnValue(insertChain),
    } as unknown as ReturnType<typeof createAdminClient>,
    insertChain,
  };
}

describe("requestEmailChange", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    expect(await requestEmailChange("new@example.com")).toEqual({
      error: "Not authenticated",
    });
  });

  describe("rate limiting", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("rejects when the rate limit is exceeded", async () => {
      vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: false, used: 21, limit: 20, retryAfterSeconds: 30 });
      const result = await requestEmailChange("new@example.com");
      expect(result).toEqual({ error: "Too many requests. Try again in 30s." });
    });
  });

  describe("email format validation", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("rejects an address with no @", async () => {
      expect(await requestEmailChange("notanemail")).toEqual({
        error: "Invalid email address",
      });
    });

    it("rejects an address with no domain", async () => {
      expect(await requestEmailChange("user@")).toEqual({
        error: "Invalid email address",
      });
    });

    it("rejects an address with no TLD", async () => {
      expect(await requestEmailChange("user@domain")).toEqual({
        error: "Invalid email address",
      });
    });

    it("accepts a well-formed email address", async () => {
      const { client } = dbWithRpc(false);
      mockCreateAdminClient.mockReturnValue(client);
      expect(await requestEmailChange("new@example.com")).toEqual({ ok: true });
    });
  });

  describe("duplicate email check", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("rejects if the email is already in use", async () => {
      const { client } = dbWithRpc(true);
      mockCreateAdminClient.mockReturnValue(client);
      expect(await requestEmailChange("taken@example.com")).toEqual({
        error: "That email is already in use",
      });
    });
  });

  describe("token generation", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("inserts a token row with the correct user_id and new_email", async () => {
      const { client, insertChain } = dbWithRpc(false);
      mockCreateAdminClient.mockReturnValue(client);
      await requestEmailChange("new@example.com");
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: USER_ID, new_email: "new@example.com" })
      );
    });

    it("generates a 64-char hex token", async () => {
      const { client, insertChain } = dbWithRpc(false);
      mockCreateAdminClient.mockReturnValue(client);
      await requestEmailChange("new@example.com");
      const args = insertChain.insert.mock.calls[0][0] as { token: string };
      expect(args.token).toMatch(/^[0-9a-f]{64}$/);
    });

    it("sets an expiry ~1 hour in the future", async () => {
      const { client, insertChain } = dbWithRpc(false);
      mockCreateAdminClient.mockReturnValue(client);
      const before = Date.now();
      await requestEmailChange("new@example.com");
      const after = Date.now();
      const args = insertChain.insert.mock.calls[0][0] as { expires_at: string };
      const expiry = new Date(args.expires_at).getTime();
      expect(expiry).toBeGreaterThan(before + 59 * 60 * 1000);
      expect(expiry).toBeLessThan(after + 61 * 60 * 1000);
    });
  });

  describe("input normalisation", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("trims and lowercases the email", async () => {
      const { client, insertChain } = dbWithRpc(false);
      mockCreateAdminClient.mockReturnValue(client);
      await requestEmailChange("  NEW@EXAMPLE.COM  ");
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ new_email: "new@example.com" })
      );
    });
  });

  describe("email send resilience", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("still returns ok when sendEmailVerification throws", async () => {
      vi.mocked(sendEmailVerification).mockRejectedValue(new Error("SMTP error"));
      const { client } = dbWithRpc(false);
      mockCreateAdminClient.mockReturnValue(client);
      expect(await requestEmailChange("new@example.com")).toEqual({ ok: true });
    });
  });

  describe("DB insert failure", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("returns error when the token insert fails", async () => {
      const { client } = dbWithRpc(false, { message: "constraint violation" });
      mockCreateAdminClient.mockReturnValue(client);
      expect(await requestEmailChange("new@example.com")).toEqual({
        error: "Could not create verification token",
      });
    });
  });
});
