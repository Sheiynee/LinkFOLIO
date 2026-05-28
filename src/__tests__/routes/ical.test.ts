import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "@/app/api/ical/[username]/route";
import { chain, mockDb } from "../helpers/supabase-mock";

const mockCreateAdminClient = vi.mocked(createAdminClient);

const MOCK_PROFILE = { id: "user-1", username: "alice", display_name: "Alice" };

const MOCK_SCHEDULE_META = {
  timezone: "America/New_York",
  events: [
    { id: "ev-1", day: "tue", startTime: "19:00", endTime: "21:00", label: "Fortnite Tuesday" },
    { id: "ev-2", day: "fri", startTime: "20:00", label: "Friday Chill" },
  ],
  note: "Usually late",
};

function params(username: string) {
  return { params: { username } };
}

describe("GET /api/ical/[username]", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("not found cases", () => {
    it("returns 404 for an unknown username", async () => {
      mockCreateAdminClient.mockReturnValue(
        mockDb(chain({ data: null, error: null }))
      );
      const res = await GET({} as never, params("nobody"));
      expect(res.status).toBe(404);
    });
  });

  describe("content-type and headers", () => {
    it("returns text/calendar content-type", async () => {
      mockCreateAdminClient.mockReturnValue(
        mockDb(
          chain({ data: MOCK_PROFILE, error: null }),
          chain({ data: [], error: null })
        )
      );
      const res = await GET({} as never, params("alice"));
      expect(res.headers.get("Content-Type")).toContain("text/calendar");
    });

    it("includes Content-Disposition with the username as the filename", async () => {
      mockCreateAdminClient.mockReturnValue(
        mockDb(
          chain({ data: MOCK_PROFILE, error: null }),
          chain({ data: [], error: null })
        )
      );
      const res = await GET({} as never, params("alice"));
      expect(res.headers.get("Content-Disposition")).toContain("alice-schedule.ics");
    });

    it("sets Cache-Control: no-cache", async () => {
      mockCreateAdminClient.mockReturnValue(
        mockDb(
          chain({ data: MOCK_PROFILE, error: null }),
          chain({ data: [], error: null })
        )
      );
      const res = await GET({} as never, params("alice"));
      expect(res.headers.get("Cache-Control")).toBe("no-cache");
    });
  });

  describe("ICS structure", () => {
    it("wraps the calendar in BEGIN:VCALENDAR / END:VCALENDAR", async () => {
      mockCreateAdminClient.mockReturnValue(
        mockDb(
          chain({ data: MOCK_PROFILE, error: null }),
          chain({ data: [], error: null })
        )
      );
      const body = await (await GET({} as never, params("alice"))).text();
      expect(body).toContain("BEGIN:VCALENDAR");
      expect(body).toContain("END:VCALENDAR");
    });

    it("includes standard iCalendar fields", async () => {
      mockCreateAdminClient.mockReturnValue(
        mockDb(
          chain({ data: MOCK_PROFILE, error: null }),
          chain({ data: [], error: null })
        )
      );
      const body = await (await GET({} as never, params("alice"))).text();
      expect(body).toContain("VERSION:2.0");
      expect(body).toContain("CALSCALE:GREGORIAN");
    });

    it("produces a valid calendar with no VEVENTs when there are no schedule blocks", async () => {
      mockCreateAdminClient.mockReturnValue(
        mockDb(
          chain({ data: MOCK_PROFILE, error: null }),
          chain({ data: [], error: null })
        )
      );
      const body = await (await GET({} as never, params("alice"))).text();
      expect(body).not.toContain("BEGIN:VEVENT");
    });

    it("produces one VEVENT per schedule event", async () => {
      mockCreateAdminClient.mockReturnValue(
        mockDb(
          chain({ data: MOCK_PROFILE, error: null }),
          chain({ data: [{ meta: MOCK_SCHEDULE_META }], error: null })
        )
      );
      const body = await (await GET({} as never, params("alice"))).text();
      const eventCount = (body.match(/BEGIN:VEVENT/g) ?? []).length;
      expect(eventCount).toBe(2);
    });

    it("RRULE is FREQ=WEEKLY with the correct BYDAY", async () => {
      mockCreateAdminClient.mockReturnValue(
        mockDb(
          chain({ data: MOCK_PROFILE, error: null }),
          chain({ data: [{ meta: MOCK_SCHEDULE_META }], error: null })
        )
      );
      const body = await (await GET({} as never, params("alice"))).text();
      expect(body).toContain("RRULE:FREQ=WEEKLY;BYDAY=TU");
      expect(body).toContain("RRULE:FREQ=WEEKLY;BYDAY=FR");
    });

    it("VEVENT includes the event label as SUMMARY", async () => {
      mockCreateAdminClient.mockReturnValue(
        mockDb(
          chain({ data: MOCK_PROFILE, error: null }),
          chain({ data: [{ meta: MOCK_SCHEDULE_META }], error: null })
        )
      );
      const body = await (await GET({} as never, params("alice"))).text();
      expect(body).toContain("SUMMARY:Fortnite Tuesday");
      expect(body).toContain("SUMMARY:Friday Chill");
    });

    it("VEVENT includes the timezone in DTSTART", async () => {
      mockCreateAdminClient.mockReturnValue(
        mockDb(
          chain({ data: MOCK_PROFILE, error: null }),
          chain({ data: [{ meta: MOCK_SCHEDULE_META }], error: null })
        )
      );
      const body = await (await GET({} as never, params("alice"))).text();
      expect(body).toContain("DTSTART;TZID=America/New_York:");
    });

    it("VEVENT UID uses the event id and @linkfolio suffix", async () => {
      mockCreateAdminClient.mockReturnValue(
        mockDb(
          chain({ data: MOCK_PROFILE, error: null }),
          chain({ data: [{ meta: MOCK_SCHEDULE_META }], error: null })
        )
      );
      const body = await (await GET({} as never, params("alice"))).text();
      expect(body).toContain("UID:ev-1@linkfolio");
    });

    it("escapes commas in summary text", async () => {
      const metaWithComma = {
        timezone: "UTC",
        events: [{ id: "e1", day: "mon", startTime: "10:00", label: "Gaming, chilling" }],
      };
      mockCreateAdminClient.mockReturnValue(
        mockDb(
          chain({ data: MOCK_PROFILE, error: null }),
          chain({ data: [{ meta: metaWithComma }], error: null })
        )
      );
      const body = await (await GET({} as never, params("alice"))).text();
      expect(body).toContain("SUMMARY:Gaming\\, chilling");
    });
  });
});
