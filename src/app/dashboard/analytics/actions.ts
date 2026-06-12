"use server";

import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AnalyticsData {
  viewsOverTime: { date: string; views: number }[];
  totalViews: number;
  totalClicks: number;
  topReferrers: { domain: string; clicks: number }[];
  topCountries: { country: string; clicks: number }[];
  widgetClicks: { title: string; widget_kind: string | null; clicks: number }[];
}

function cutoffDate(days: number): string | null {
  if (days === 0) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

interface ClickStats {
  total_clicks: number;
  referrers: { domain: string; clicks: number }[];
  countries: { country: string; clicks: number }[];
}

const EMPTY_CLICK_STATS: ClickStats = { total_clicks: 0, referrers: [], countries: [] };

export async function getAnalyticsData(days: number): Promise<AnalyticsData | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const userId = session.user.id;
  const supabase = createAdminClient();
  const cutoff = cutoffDate(days);

  // All blocks owned by this user (for filtering clicks).
  const { data: blocks } = await supabase
    .from("blocks")
    .select("id, title, widget_kind")
    .eq("user_id", userId);
  const ownedBlockIds = new Set((blocks ?? []).map((b) => b.id));
  const blockMeta = Object.fromEntries((blocks ?? []).map((b) => [b.id, { title: b.title, widget_kind: b.widget_kind }]));

  // Views over time from materialized view.
  let viewsQuery = supabase
    .from("mv_page_views_daily")
    .select("day, views")
    .eq("profile_id", userId)
    .order("day", { ascending: true });
  if (cutoff) viewsQuery = viewsQuery.gte("day", cutoff);
  const { data: viewsRows } = await viewsQuery;

  const viewsOverTime = (viewsRows ?? []).map((r) => ({
    date: String(r.day).slice(0, 10),
    views: r.views as number,
  }));
  const totalViews = viewsOverTime.reduce((s, r) => s + r.views, 0);

  // Clicks aggregated in Postgres (`get_click_stats` RPC, migration 22).
  // Selecting raw rows here hit Supabase's 1000-row response cap, silently
  // undercounting totals and breakdowns for active creators.
  const { data: clickStats } = await supabase.rpc("get_click_stats", {
    p_user_id: userId,
    p_cutoff: cutoff ? cutoff + "T00:00:00Z" : null,
  });
  const stats: ClickStats = { ...EMPTY_CLICK_STATS, ...((clickStats ?? {}) as Partial<ClickStats>) };
  const totalClicks = stats.total_clicks;
  const topReferrers = stats.referrers;
  const topCountries = stats.countries;

  // Per-widget clicks from materialized view.
  const blockIdList = Array.from(ownedBlockIds);
  let widgetClicksQuery = supabase
    .from("mv_block_clicks_daily")
    .select("block_id, clicks")
    .in("block_id", blockIdList.length > 0 ? blockIdList : ["none"]);
  if (cutoff) widgetClicksQuery = widgetClicksQuery.gte("day", cutoff);
  const { data: widgetClickRows } = await widgetClicksQuery;

  const widgetClickMap = new Map<string, number>();
  for (const r of widgetClickRows ?? []) {
    widgetClickMap.set(r.block_id, (widgetClickMap.get(r.block_id) ?? 0) + (r.clicks as number));
  }

  const widgetClicks = Array.from(widgetClickMap.entries())
    .map(([blockId, clicks]) => ({
      title: blockMeta[blockId]?.title ?? "Untitled",
      widget_kind: blockMeta[blockId]?.widget_kind ?? null,
      clicks,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 20);

  return { viewsOverTime, totalViews, totalClicks, topReferrers, topCountries, widgetClicks };
}
