import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/app/dashboard/analytics/actions", () => ({ getAnalyticsData: vi.fn() }));

import { auth } from "@/auth";
import { getAnalyticsData } from "@/app/dashboard/analytics/actions";
import { GET } from "@/app/api/analytics/export/route";
import type { AnalyticsData } from "@/app/dashboard/analytics/actions";

const mockAuth = vi.mocked(auth);
const mockGetAnalyticsData = vi.mocked(getAnalyticsData);

const SESSION = { user: { id: "user-1" } };

const EMPTY_DATA: AnalyticsData = {
  viewsOverTime: [],
  totalViews: 0,
  totalClicks: 0,
  topReferrers: [],
  topCountries: [],
  widgetClicks: [],
};

function mockReq(search = "") {
  return {
    nextUrl: { searchParams: new URLSearchParams(search) },
  } as never;
}

describe("GET /api/analytics/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION as never);
    mockGetAnalyticsData.mockResolvedValue(EMPTY_DATA);
  });

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const res = await GET(mockReq());
      expect(res.status).toBe(401);
    });
  });

  describe("response headers", () => {
    it("sets Content-Type to text/csv", async () => {
      const res = await GET(mockReq());
      expect(res.headers.get("Content-Type")).toBe("text/csv");
    });

    it("sets Content-Disposition as attachment with a .csv filename", async () => {
      const res = await GET(mockReq());
      const disposition = res.headers.get("Content-Disposition") ?? "";
      expect(disposition).toContain("attachment");
      expect(disposition).toContain(".csv");
    });
  });

  describe("days parameter parsing", () => {
    it("passes 7 to getAnalyticsData by default (no param)", async () => {
      await GET(mockReq());
      expect(mockGetAnalyticsData).toHaveBeenCalledWith(7);
    });

    it('passes 0 to getAnalyticsData for days=all (all-time)', async () => {
      await GET(mockReq("days=all"));
      expect(mockGetAnalyticsData).toHaveBeenCalledWith(0);
    });

    it("passes 30 to getAnalyticsData for days=30", async () => {
      await GET(mockReq("days=30"));
      expect(mockGetAnalyticsData).toHaveBeenCalledWith(30);
    });

    it("passes 90 to getAnalyticsData for days=90", async () => {
      await GET(mockReq("days=90"));
      expect(mockGetAnalyticsData).toHaveBeenCalledWith(90);
    });

    it("falls back to 7 for a non-numeric days param", async () => {
      await GET(mockReq("days=xyz"));
      expect(mockGetAnalyticsData).toHaveBeenCalledWith(7);
    });
  });

  describe("CSV structure", () => {
    it("contains the Views Over Time section header", async () => {
      const body = await (await GET(mockReq())).text();
      expect(body).toContain("=== Views Over Time ===");
    });

    it("contains the Top Referrers section header", async () => {
      const body = await (await GET(mockReq())).text();
      expect(body).toContain("=== Top Referrers ===");
    });

    it("contains the Top Countries section header", async () => {
      const body = await (await GET(mockReq())).text();
      expect(body).toContain("=== Top Countries ===");
    });

    it("contains the Clicks by Block section header", async () => {
      const body = await (await GET(mockReq())).text();
      expect(body).toContain("=== Clicks by Block ===");
    });

    it("includes Date,Views column headers under views section", async () => {
      const body = await (await GET(mockReq())).text();
      expect(body).toContain('"Date","Views"');
    });

    it("serialises view rows correctly", async () => {
      mockGetAnalyticsData.mockResolvedValue({
        ...EMPTY_DATA,
        viewsOverTime: [{ date: "2026-01-01", views: 42 }],
        totalViews: 42,
      });
      const body = await (await GET(mockReq())).text();
      expect(body).toContain('"2026-01-01","42"');
    });

    it("escapes double-quotes in cell values", async () => {
      mockGetAnalyticsData.mockResolvedValue({
        ...EMPTY_DATA,
        widgetClicks: [{ title: 'My "Best" Stream', widget_kind: "twitch_live", clicks: 5 }],
      });
      const body = await (await GET(mockReq())).text();
      // RFC 4180: " → ""
      expect(body).toContain('"My ""Best"" Stream"');
    });
  });

  describe("error handling", () => {
    it("returns 500 when getAnalyticsData returns an error", async () => {
      mockGetAnalyticsData.mockResolvedValue({ error: "DB unavailable" });
      const res = await GET(mockReq());
      expect(res.status).toBe(500);
      expect(await res.text()).toBe("DB unavailable");
    });
  });
});
