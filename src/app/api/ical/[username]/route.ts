import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StreamScheduleMeta, ScheduleEvent } from "@/lib/widgets/types";

export const dynamic = "force-dynamic";

const BYDAY: Record<ScheduleEvent["day"], string> = {
  mon: "MO", tue: "TU", wed: "WE", thu: "TH", fri: "FR", sat: "SA", sun: "SU",
};

// JS getDay() values for each day key (Sun=0, Mon=1, ...)
const DAY_JS: Record<ScheduleEvent["day"], number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

function nextOccurrenceDate(day: ScheduleEvent["day"], startTime: string): Date {
  const [h, m] = startTime.split(":").map(Number);
  const now = new Date();
  const target = DAY_JS[day];
  let diff = target - now.getDay();
  if (diff < 0) diff += 7;
  // If today is the day but time already passed, push to next week.
  if (diff === 0 && now.getHours() * 60 + now.getMinutes() >= (h ?? 0) * 60 + (m ?? 0)) {
    diff = 7;
  }
  const d = new Date(now);
  d.setDate(d.getDate() + diff);
  d.setHours(h ?? 18, m ?? 0, 0, 0);
  return d;
}

function formatIcsDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } }
) {
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", params.username.toLowerCase())
    .is("deleted_at", null)
    .maybeSingle();

  if (!profile) return new NextResponse("Not found", { status: 404 });

  const { data: blocks } = await supabase
    .from("blocks")
    .select("meta")
    .eq("user_id", profile.id)
    .eq("widget_kind", "stream_schedule")
    .eq("visible", true);

  const events: string[] = [];

  for (const block of blocks ?? []) {
    const schedule = block.meta as StreamScheduleMeta | null;
    if (!schedule?.events?.length) continue;

    const tzid = schedule.timezone ?? "UTC";

    for (const ev of schedule.events) {
      const dtstart = nextOccurrenceDate(ev.day, ev.startTime);
      const dtend = ev.endTime
        ? (() => {
            const [eh, em] = ev.endTime.split(":").map(Number);
            const e = new Date(dtstart);
            e.setHours(eh ?? dtstart.getHours() + 1, em ?? 0, 0, 0);
            return e;
          })()
        : new Date(dtstart.getTime() + 60 * 60 * 1000); // default 1h

      events.push([
        "BEGIN:VEVENT",
        `UID:${ev.id}@linkfolio`,
        `DTSTART;TZID=${tzid}:${formatIcsDate(dtstart)}`,
        `DTEND;TZID=${tzid}:${formatIcsDate(dtend)}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[ev.day]}`,
        `SUMMARY:${escapeIcs(ev.label)}`,
        schedule.note ? `DESCRIPTION:${escapeIcs(schedule.note)}` : "",
        "END:VEVENT",
      ].filter(Boolean).join("\r\n"));
    }
  }

  const displayName = profile.display_name ?? profile.username;
  const cal = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LinkFolio//Stream Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(displayName)}'s Stream Schedule`,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(cal, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${profile.username}-schedule.ics"`,
      "Cache-Control": "no-cache",
    },
  });
}
