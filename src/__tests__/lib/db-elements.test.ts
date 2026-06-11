import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { getElementsByUserId } from "@/lib/db/elements";
import { chain, mockDb } from "../helpers/supabase-mock";

const mockCreateAdminClient = vi.mocked(createAdminClient);

describe("getElementsByUserId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("selects the mobile override columns so saved mobile layouts load", async () => {
    const c = chain({ data: [], error: null });
    mockCreateAdminClient.mockReturnValue(mockDb(c));
    await getElementsByUserId("user-1");
    const fields = c.select.mock.calls[0][0] as string;
    for (const col of ["mobile_x", "mobile_y", "mobile_w", "mobile_h"]) {
      expect(fields).toContain(col);
    }
  });

  it("filters by user id and orders by z", async () => {
    const c = chain({ data: [], error: null });
    mockCreateAdminClient.mockReturnValue(mockDb(c));
    await getElementsByUserId("user-1");
    expect(c.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(c.order).toHaveBeenCalledWith("z", { ascending: true });
  });
});
