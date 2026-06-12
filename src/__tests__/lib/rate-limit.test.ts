import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, RL_REDIRECT } from "@/lib/rate-limit";

const mockCreateAdminClient = vi.mocked(createAdminClient);

function dbWithRpc(result: { used: number; oldest: string | null } | null, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data: result, error });
  mockCreateAdminClient.mockReturnValue({ rpc } as unknown as ReturnType<typeof createAdminClient>);
  return rpc;
}

describe("rateLimit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("makes a single atomic RPC call with scope, key, bucket and cutoff", async () => {
    const rpc = dbWithRpc({ used: 1, oldest: new Date().toISOString() });
    await rateLimit("1.2.3.4", RL_REDIRECT);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("rate_limit_hit", {
      p_scope: "redirect",
      p_key: "1.2.3.4",
      p_window_start: expect.any(String),
      p_cutoff: expect.any(String),
    });
  });

  it("allows when under the limit", async () => {
    dbWithRpc({ used: 5, oldest: new Date().toISOString() });
    const res = await rateLimit("k", RL_REDIRECT);
    expect(res.allowed).toBe(true);
    expect(res.used).toBe(5);
  });

  it("denies past the limit with a retry-after derived from the oldest bucket", async () => {
    const oldest = new Date(Date.now() - 30 * 1000).toISOString(); // 30s into a 60s window
    dbWithRpc({ used: 61, oldest });
    const res = await rateLimit("k", RL_REDIRECT);
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
    expect(res.retryAfterSeconds).toBeLessThanOrEqual(30);
  });

  it("fails open when the RPC errors", async () => {
    dbWithRpc(null, { message: "function does not exist" });
    const res = await rateLimit("k", RL_REDIRECT);
    expect(res.allowed).toBe(true);
  });
});
