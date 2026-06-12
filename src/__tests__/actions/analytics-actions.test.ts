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

type Block = { id: string; title: string; widget_kind: string | null };

interface ClickStats {
  total_clicks: number;
  referrers: { domain: string; clicks: number }[];
  countries: { country: string; clicks: number }[];
}

function dbForAnalytics(
  blocks: Block[],
  views: unknown[],
  clickStats: ClickStats | null,
  widgetClicks: unknown[]
) {
  return {
    from: vi.fn()
      .mockReturnValueOnce(chain({ data: blocks, error: null }))          // blocks
      .mockReturnValueOnce(chain({ data: views, error: null }))           // mv_page_views_daily
      .mockReturnValueOnce(chain({ data: widgetClicks, error: null })),   // mv_block_clicks_daily
    rpc: vi.fn().mockResolvedValue({ data: clickStats, error: null }),
  } as unknown as ReturnType<typeof createAdminClient> & { rpc: ReturnType<typeof vi.fn> };
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
      mockCreateAdminClient.mockReturnValue(dbForAnalytics([], [], null, []));
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

    it("defaults to zero/empty when the RPC returns no data", async () => {
      mockCreateAdminClient.mockReturnValue(dbForAnalytics([], [], null, []));
      const result = await getAnalyticsData(7);
      if ("error" in result) throw new Error(result.error);
      expect(result.totalClicks).toBe(0);
      expect(result.topReferrers).toEqual([]);
      expect(result.topCountries).toEqual([]);
    });
  });

  describe("click stats via Postgres RPC", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    const STATS: ClickStats = {
      total_clicks: 4321, // > 1000 — the old raw-row path couldn't report this
      referrers: [
        { domain: "twitter.com", clicks: 3000 },
        { domain: "Direct", clicks: 1321 },
      ],
      countries: [
        { country: "US", clicks: 4000 },
        { country: "Unknown", clicks: 321 },
      ],
    };

    it("passes the aggregated stats straight through", async () => {
      mockCreateAdminClient.mockReturnValue(dbForAnalytics([], [], STATS, []));
      const result = await getAnalyticsData(30);
      if ("error" in result) throw new Error(result.error);
      expect(result.totalClicks).toBe(4321);
      expect(result.topReferrers).toEqual(STATS.referrers);
      expect(result.topCountries).toEqual(STATS.countries);
    });

    it("calls get_click_stats with the user id and a cutoff timestamp", async () => {
      const db = dbForAnalytics([], [], STATS, []);
      mockCreateAdminClient.mockReturnValue(db);
      await getAnalyticsData(7);
      expect(db.rpc).toHaveBeenCalledWith("get_click_stats", {
        p_user_id: USER_ID,
        p_cutoff: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T00:00:00Z$/),
      });
    });

    it("passes a null cutoff for the all-time range (days=0)", async () => {
      const db = dbForAnalytics([], [], STATS, []);
      mockCreateAdminClient.mockReturnValue(db);
      await getAnalyticsData(0);
      expect(db.rpc).toHaveBeenCalledWith("get_click_stats", {
        p_user_id: USER_ID,
        p_cutoff: null,
      });
    });
  });

  describe("views over time", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("maps daily rows and sums the total", async () => {
      const views = [
        { day: "2026-06-01T00:00:00", views: 5 },
        { day: "2026-06-02T00:00:00", views: 7 },
      ];
      mockCreateAdminClient.mockReturnValue(dbForAnalytics([], views, null, []));
      const result = await getAnalyticsData(30);
      if ("error" in result) throw new Error(result.error);
      expect(result.viewsOverTime).toEqual([
        { date: "2026-06-01", views: 5 },
        { date: "2026-06-02", views: 7 },
      ]);
      expect(result.totalViews).toBe(12);
    });
  });

  describe("widget clicks", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    it("sums daily click rows per block and resolves block titles", async () => {
      const blocks: Block[] = [{ id: "b1", title: "My link", widget_kind: null }];
      const widgetClicks = [
        { block_id: "b1", clicks: 3 },
        { block_id: "b1", clicks: 2 },
      ];
      mockCreateAdminClient.mockReturnValue(dbForAnalytics(blocks, [], null, widgetClicks));
      const result = await getAnalyticsData(30);
      if ("error" in result) throw new Error(result.error);
      expect(result.widgetClicks).toEqual([
        { title: "My link", widget_kind: null, clicks: 5 },
      ]);
    });
  });

  describe("date cutoff", () => {
    beforeEach(() => mockAuth.mockResolvedValue(SESSION as never));

    function sharedChainDb() {
      const sharedChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (_resolve: (v: unknown) => void) =>
          Promise.resolve({ data: [], error: null }).then(_resolve),
      };
      const db = {
        from: vi.fn().mockReturnValue(sharedChain),
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as unknown as ReturnType<typeof createAdminClient>;
      return { db, sharedChain };
    }

    it("does not apply a gte filter when days=0", async () => {
      const { db, sharedChain } = sharedChainDb();
      mockCreateAdminClient.mockReturnValue(db);
      await getAnalyticsData(0);
      expect(sharedChain.gte).not.toHaveBeenCalled();
    });

    it("applies a gte filter when days > 0", async () => {
      const { db, sharedChain } = sharedChainDb();
      mockCreateAdminClient.mockReturnValue(db);
      await getAnalyticsData(7);
      expect(sharedChain.gte).toHaveBeenCalled();
    });
  });
});
