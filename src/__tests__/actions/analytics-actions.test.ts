import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnalyticsData } from "@/app/dashboard/analytics/actions";
import { chain } from "../helpers/supabase-mock";

const mockAuth = vi.mocked(auth);
const mockCreateAdminClient = vi.mocked(createAdminClient);

const USER_ID = "user-abc";
const SESSION = { user: { id: USER_ID } };

type ClickRow = { block_id: string; referrer: string | null; country: string | null; clicked_at: string };
type Block = { id: string; title: string; widget_kind: string | null };

function dbForAnalytics(
  blocks: Block[],
  views: unknown[],
  clicks: ClickRow[],
  widgetClicks: unknown[]
) {
  return {
    from: vi.fn()
      .mockReturnValueOnce(chain({ data: blocks, error: null }))          // blocks
      .mockReturnValueOnce(chain({ data: views, error: null }))           // mv_page_views_daily
      .mockReturnValueOnce(chain({ data: clicks, error: null }))          // block_clicks
      .mockReturnValueOnce(chain({ data: widgetClicks, error: null })),   // mv_block_clicks_daily
  } as unknown as ReturnType<typeof createAdminClient>;
}

describe("getAnalyticsData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    expect(await getAnalyticsData(7)).toEqual({ error: "Not authenticated" });
  });

  describe("response shape", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("returns all required fields", async () => {
      mockCreateAdminClient.mockReturnValue(dbForAnalytics([], [], [], []));
      const result = await getAnalyticsData(7);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result).toHaveProperty("viewsOverTime");
        expect(result).toHaveProperty("totalViews");
        expect(result).toHaveProperty("totalClicks");
        expect(result).toHaveProperty("topReferrers");
        expect(result).toHaveProperty("topCountries");
        expect(result).toHaveProperty("widgetClicks");
      }
    });

    it("returns arrays for collection fields", async () => {
      mockCreateAdminClient.mockReturnValue(dbForAnalytics([], [], [], []));
      const result = await getAnalyticsData(7);
      if (!("error" in result)) {
        expect(Array.isArray(result.viewsOverTime)).toBe(true);
        expect(Array.isArray(result.topReferrers)).toBe(true);
        expect(Array.isArray(result.topCountries)).toBe(true);
        expect(Array.isArray(result.widgetClicks)).toBe(true);
      }
    });
  });

  describe("referrer domain extraction", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("extracts hostname from a full referrer URL", async () => {
      const clicks: ClickRow[] = [
        { block_id: "b1", referrer: "https://twitter.com/home", country: "US", clicked_at: "2026-01-01" },
        { block_id: "b1", referrer: "https://twitter.com/explore", country: "US", clicked_at: "2026-01-01" },
      ];
      mockCreateAdminClient.mockReturnValue(
        dbForAnalytics([{ id: "b1", title: "Link", widget_kind: null }], [], clicks, [])
      );
      const result = await getAnalyticsData(30);
      if ("error" in result) throw new Error(result.error);
      const tw = result.topReferrers.find((r) => r.domain === "twitter.com");
      expect(tw?.clicks).toBe(2);
    });

    it("strips www. prefix from domain", async () => {
      const clicks: ClickRow[] = [
        { block_id: "b1", referrer: "https://www.google.com/search", country: "US", clicked_at: "2026-01-01" },
      ];
      mockCreateAdminClient.mockReturnValue(
        dbForAnalytics([{ id: "b1", title: "Link", widget_kind: null }], [], clicks, [])
      );
      const result = await getAnalyticsData(30);
      if ("error" in result) throw new Error(result.error);
      expect(result.topReferrers[0].domain).toBe("google.com");
    });

    it("labels null referrer as Direct", async () => {
      const clicks: ClickRow[] = [
        { block_id: "b1", referrer: null, country: "US", clicked_at: "2026-01-01" },
        { block_id: "b1", referrer: null, country: "CA", clicked_at: "2026-01-01" },
      ];
      mockCreateAdminClient.mockReturnValue(
        dbForAnalytics([{ id: "b1", title: "Link", widget_kind: null }], [], clicks, [])
      );
      const result = await getAnalyticsData(7);
      if ("error" in result) throw new Error(result.error);
      const direct = result.topReferrers.find((r) => r.domain === "Direct");
      expect(direct?.clicks).toBe(2);
    });

    it("labels an unparseable referrer string as Direct", async () => {
      const clicks: ClickRow[] = [
        { block_id: "b1", referrer: "not a url", country: "US", clicked_at: "2026-01-01" },
      ];
      mockCreateAdminClient.mockReturnValue(
        dbForAnalytics([{ id: "b1", title: "Link", widget_kind: null }], [], clicks, [])
      );
      const result = await getAnalyticsData(7);
      if ("error" in result) throw new Error(result.error);
      expect(result.topReferrers[0].domain).toBe("Direct");
    });

    it("limits topReferrers to 8 entries", async () => {
      const clicks: ClickRow[] = Array.from({ length: 10 }, (_, i) => ({
        block_id: "b1",
        referrer: `https://site${i}.example.com/`,
        country: "US",
        clicked_at: "2026-01-01",
      }));
      mockCreateAdminClient.mockReturnValue(
        dbForAnalytics([{ id: "b1", title: "Link", widget_kind: null }], [], clicks, [])
      );
      const result = await getAnalyticsData(7);
      if ("error" in result) throw new Error(result.error);
      expect(result.topReferrers.length).toBeLessThanOrEqual(8);
    });
  });

  describe("country aggregation", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("counts clicks per country", async () => {
      const clicks: ClickRow[] = [
        { block_id: "b1", referrer: null, country: "US", clicked_at: "2026-01-01" },
        { block_id: "b1", referrer: null, country: "US", clicked_at: "2026-01-01" },
        { block_id: "b1", referrer: null, country: "GB", clicked_at: "2026-01-01" },
      ];
      mockCreateAdminClient.mockReturnValue(
        dbForAnalytics([{ id: "b1", title: "Link", widget_kind: null }], [], clicks, [])
      );
      const result = await getAnalyticsData(7);
      if ("error" in result) throw new Error(result.error);
      const us = result.topCountries.find((c) => c.country === "US");
      expect(us?.clicks).toBe(2);
    });

    it("sorts countries by click count descending", async () => {
      const clicks: ClickRow[] = [
        { block_id: "b1", referrer: null, country: "GB", clicked_at: "2026-01-01" },
        { block_id: "b1", referrer: null, country: "US", clicked_at: "2026-01-01" },
        { block_id: "b1", referrer: null, country: "US", clicked_at: "2026-01-01" },
      ];
      mockCreateAdminClient.mockReturnValue(
        dbForAnalytics([{ id: "b1", title: "Link", widget_kind: null }], [], clicks, [])
      );
      const result = await getAnalyticsData(7);
      if ("error" in result) throw new Error(result.error);
      expect(result.topCountries[0].country).toBe("US");
    });

    it("labels null country as Unknown", async () => {
      const clicks: ClickRow[] = [
        { block_id: "b1", referrer: null, country: null, clicked_at: "2026-01-01" },
      ];
      mockCreateAdminClient.mockReturnValue(
        dbForAnalytics([{ id: "b1", title: "Link", widget_kind: null }], [], clicks, [])
      );
      const result = await getAnalyticsData(7);
      if ("error" in result) throw new Error(result.error);
      expect(result.topCountries[0].country).toBe("Unknown");
    });
  });

  describe("click totals", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("totalClicks equals the number of click rows returned", async () => {
      const clicks: ClickRow[] = [
        { block_id: "b1", referrer: null, country: "US", clicked_at: "2026-01-01" },
        { block_id: "b1", referrer: null, country: "US", clicked_at: "2026-01-01" },
        { block_id: "b2", referrer: null, country: "US", clicked_at: "2026-01-01" },
      ];
      mockCreateAdminClient.mockReturnValue(
        dbForAnalytics(
          [{ id: "b1", title: "L1", widget_kind: null }, { id: "b2", title: "L2", widget_kind: null }],
          [],
          clicks,
          []
        )
      );
      const result = await getAnalyticsData(7);
      if ("error" in result) throw new Error(result.error);
      expect(result.totalClicks).toBe(3);
    });
  });

  describe("date cutoff", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("does not apply a gte filter when days=0", async () => {
      const sharedChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (_resolve: (v: unknown) => void) =>
          Promise.resolve({ data: [], error: null }).then(_resolve),
      };
      mockCreateAdminClient.mockReturnValue({
        from: vi.fn().mockReturnValue(sharedChain),
      } as unknown as ReturnType<typeof createAdminClient>);

      await getAnalyticsData(0);

      // No date cutoff should be applied when days=0
      expect(sharedChain.gte).not.toHaveBeenCalled();
    });

    it("applies a gte filter when days > 0", async () => {
      const sharedChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (_resolve: (v: unknown) => void) =>
          Promise.resolve({ data: [], error: null }).then(_resolve),
      };
      mockCreateAdminClient.mockReturnValue({
        from: vi.fn().mockReturnValue(sharedChain),
      } as unknown as ReturnType<typeof createAdminClient>);

      await getAnalyticsData(7);

      expect(sharedChain.gte).toHaveBeenCalled();
    });
  });
});
