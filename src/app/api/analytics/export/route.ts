import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAnalyticsData } from "@/app/dashboard/analytics/actions";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const daysParam = request.nextUrl.searchParams.get("days") ?? "7";
  const days = daysParam === "all" ? 0 : Math.max(0, parseInt(daysParam, 10) || 7);

  const result = await getAnalyticsData(days);
  if ("error" in result) return new NextResponse(result.error, { status: 500 });

  const rows: string[][] = [];

  rows.push(["=== Views Over Time ==="], ["Date", "Views"]);
  for (const r of result.viewsOverTime) rows.push([r.date, String(r.views)]);

  rows.push([], ["=== Top Referrers ==="], ["Domain", "Clicks"]);
  for (const r of result.topReferrers) rows.push([r.domain, String(r.clicks)]);

  rows.push([], ["=== Top Countries ==="], ["Country", "Clicks"]);
  for (const r of result.topCountries) rows.push([r.country, String(r.clicks)]);

  rows.push([], ["=== Clicks by Block ==="], ["Title", "Widget Kind", "Clicks"]);
  for (const r of result.widgetClicks) rows.push([r.title, r.widget_kind ?? "", String(r.clicks)]);

  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
  const filename = `linkfolio-analytics-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
