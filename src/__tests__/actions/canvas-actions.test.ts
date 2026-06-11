import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/revalidate", () => ({ revalidatePublicPage: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/twitch-eventsub", () => ({
  ensureChannelSubscriptions: vi.fn().mockResolvedValue(undefined),
}));

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePublicPage } from "@/lib/revalidate";
import {
  batchUpdateElements,
  updateElement,
  updateMobilePlacements,
} from "@/app/dashboard/canvas/actions";
import { chain, mockDb } from "../helpers/supabase-mock";

const mockAuth = vi.mocked(auth);
const mockCreateAdminClient = vi.mocked(createAdminClient);
const SESSION = { user: { id: "user-1" } };

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(SESSION as never);
});

describe("batchUpdateElements", () => {
  it("issues every update even when one fails, and reports the error", async () => {
    const ok1 = chain({ data: null, error: null });
    const bad = chain({ data: null, error: { message: "boom" } });
    const ok2 = chain({ data: null, error: null });
    mockCreateAdminClient.mockReturnValue(mockDb(ok1, bad, ok2));

    const res = await batchUpdateElements([
      { id: "a", patch: { x: 1 } },
      { id: "b", patch: { x: 2 } },
      { id: "c", patch: { x: 3 } },
    ]);

    expect(res).toEqual({ error: "boom" });
    // Parallel execution: all three updates were dispatched, not just the
    // ones before the failure.
    expect(ok1.update).toHaveBeenCalled();
    expect(bad.update).toHaveBeenCalled();
    expect(ok2.update).toHaveBeenCalled();
  });

  it("clamps numeric fields before writing", async () => {
    const c = chain({ data: null, error: null });
    mockCreateAdminClient.mockReturnValue(mockDb(c));
    await batchUpdateElements([{ id: "a", patch: { w: 1, h: 1 } }]);
    expect(c.update).toHaveBeenCalledWith(expect.objectContaining({ w: 80, h: 32 }));
  });
});

describe("updateMobilePlacements", () => {
  it("issues every update even when one fails, and reports the error", async () => {
    const ok1 = chain({ data: null, error: null });
    const bad = chain({ data: null, error: { message: "nope" } });
    const ok2 = chain({ data: null, error: null });
    mockCreateAdminClient.mockReturnValue(mockDb(ok1, bad, ok2));

    const res = await updateMobilePlacements([
      { id: "a", mobile_x: 1 },
      { id: "b", mobile_x: 2 },
      { id: "c", mobile_x: 3 },
    ]);

    expect(res).toEqual({ error: "nope" });
    expect(ok2.update).toHaveBeenCalled();
  });
});

describe("skipRevalidate option for continuous gestures", () => {
  it("updateElement skips all revalidation when skipRevalidate is set", async () => {
    mockCreateAdminClient.mockReturnValue(mockDb(chain()));
    const res = await updateElement("e1", { x: 5 }, { skipRevalidate: true });
    expect(res).toEqual({ ok: true });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(revalidatePublicPage).not.toHaveBeenCalled();
  });

  it("updateElement revalidates by default", async () => {
    mockCreateAdminClient.mockReturnValue(mockDb(chain()));
    await updateElement("e1", { x: 5 });
    expect(revalidatePath).toHaveBeenCalled();
    expect(revalidatePublicPage).toHaveBeenCalled();
  });

  it("updateMobilePlacements skips all revalidation when skipRevalidate is set", async () => {
    mockCreateAdminClient.mockReturnValue(mockDb(chain()));
    const res = await updateMobilePlacements([{ id: "a", mobile_x: 1 }], { skipRevalidate: true });
    expect(res).toEqual({ ok: true });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(revalidatePublicPage).not.toHaveBeenCalled();
  });
});
