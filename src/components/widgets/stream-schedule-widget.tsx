import type { StreamScheduleMeta, ScheduleEvent, WidgetSize } from "@/lib/widgets/types";
import type { Theme } from "@/lib/themes";
import { CalendarDays } from "lucide-react";

const DAY_SHORT: Record<ScheduleEvent["day"], string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};
const DAY_ORDER: ScheduleEvent["day"][] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return t;
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""}${ampm}`;
}

function nextOccurrence(day: ScheduleEvent["day"]): string {
  const jsDay = DAY_ORDER.indexOf(day) + 1; // Mon=1...Sun=7, but JS: Sun=0...Sat=6
  const jsDayJS = jsDay === 7 ? 0 : jsDay;
  const now = new Date();
  const today = now.getDay();
  let diff = jsDayJS - today;
  if (diff < 0 || (diff === 0 && now.getHours() >= 23)) diff += 7;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  return DAY_SHORT[day] + " " + next.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function StreamScheduleWidget({
  data,
  theme,
  size = "default",
  icalUrl,
}: {
  data: StreamScheduleMeta | null;
  theme: Theme;
  size?: WidgetSize;
  icalUrl?: string;
}) {
  if (!data || data.events.length === 0) {
    return (
      <div
        className="w-full rounded-2xl border p-4 text-sm"
        style={{ backgroundColor: theme.button_bg, color: theme.muted_color, borderColor: theme.button_border }}
      >
        No schedule set yet.
      </div>
    );
  }

  const sorted = [...data.events].sort(
    (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)
  );

  if (size === "compact") {
    const next = sorted[0];
    return (
      <div
        className="w-full rounded-2xl border flex items-center gap-3 px-4 py-3"
        style={{ backgroundColor: theme.button_bg, color: theme.button_text, borderColor: theme.button_border }}
      >
        <CalendarDays className="h-4 w-4 shrink-0" style={{ color: theme.accent_color }} />
        <span className="text-sm font-medium flex-1">
          {next.label} — {DAY_SHORT[next.day]} {formatTime(next.startTime)}
        </span>
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-2xl border overflow-hidden"
      style={{ backgroundColor: theme.button_bg, borderColor: theme.button_border }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: theme.button_border, color: theme.button_text }}
      >
        <CalendarDays className="h-4 w-4" style={{ color: theme.accent_color }} />
        <span className="font-semibold text-sm">Stream Schedule</span>
        {data.timezone && data.timezone !== "UTC" && (
          <span className="ml-auto text-xs" style={{ color: theme.muted_color }}>{data.timezone}</span>
        )}
      </div>

      <div className="divide-y" style={{ borderColor: theme.button_border }}>
        {(size === "featured" ? sorted : sorted.slice(0, 5)).map((ev) => (
          <div
            key={ev.id}
            className="flex items-center gap-4 px-4 py-2.5"
            style={{ color: theme.button_text }}
          >
            <span className="text-xs font-mono w-9 shrink-0" style={{ color: theme.accent_color }}>
              {DAY_SHORT[ev.day]}
            </span>
            <span className="text-sm flex-1">{ev.label}</span>
            <span className="text-xs" style={{ color: theme.muted_color }}>
              {formatTime(ev.startTime)}{ev.endTime ? `–${formatTime(ev.endTime)}` : ""}
            </span>
          </div>
        ))}
      </div>

      {data.note && (
        <p className="px-4 py-2 text-xs border-t" style={{ color: theme.muted_color, borderColor: theme.button_border }}>
          {data.note}
        </p>
      )}

      {icalUrl && (
        <div className="px-4 py-3 border-t" style={{ borderColor: theme.button_border }}>
          <a
            href={icalUrl}
            className="text-xs font-medium hover:underline flex items-center gap-1.5"
            style={{ color: theme.accent_color }}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Add to calendar
          </a>
        </div>
      )}
    </div>
  );
}

// Export nextOccurrence for server-side use
export { nextOccurrence };
