"use client";

import { useState, useTransition } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Eye, MousePointerClick } from "lucide-react";
import { getAnalyticsData, type AnalyticsData } from "./actions";

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: 0 },
] as const;

export function AnalyticsDashboard({ initial }: { initial: AnalyticsData }) {
  const [data, setData] = useState<AnalyticsData>(initial);
  const [activeDays, setActiveDays] = useState(7);
  const [pending, startTransition] = useTransition();

  function handleRange(days: number) {
    setActiveDays(days);
    startTransition(async () => {
      const res = await getAnalyticsData(days);
      if (!("error" in res)) setData(res);
    });
  }

  function handleExport() {
    window.open(`/api/analytics/export?days=${activeDays}`, "_blank");
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg border p-1">
          {RANGES.map(({ label, days }) => (
            <button
              key={label}
              onClick={() => handleRange(days)}
              disabled={pending}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeDays === days
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={pending}>
          <Download className="h-4 w-4 mr-1.5" /> Export CSV
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> Page views
            </CardDescription>
            <CardTitle className="text-3xl">{data.totalViews.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <MousePointerClick className="h-3.5 w-3.5" /> Link clicks
            </CardDescription>
            <CardTitle className="text-3xl">{data.totalClicks.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Views over time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Views over time</CardTitle>
        </CardHeader>
        <CardContent>
          {data.viewsOverTime.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.viewsOverTime} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 13 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" fill="url(#viewsGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Referrers + Countries */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top referrers</CardTitle>
            <CardDescription>Where your clicks come from</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topReferrers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.topReferrers} layout="vertical" margin={{ top: 0, right: 0, left: 8, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <YAxis type="category" dataKey="domain" tick={{ fontSize: 11 }} width={90} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 13 }} />
                  <Bar dataKey="clicks" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top countries</CardTitle>
            <CardDescription>Where your visitors are</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topCountries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.topCountries} layout="vertical" margin={{ top: 0, right: 0, left: 8, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <YAxis type="category" dataKey="country" tick={{ fontSize: 11 }} width={50} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 13 }} />
                  <Bar dataKey="clicks" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-widget clicks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clicks by block</CardTitle>
          <CardDescription>Which links and widgets get clicked most</CardDescription>
        </CardHeader>
        <CardContent>
          {data.widgetClicks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No click data yet.</p>
          ) : (
            <div className="divide-y">
              {data.widgetClicks.map((row, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{row.title ?? "Untitled"}</p>
                    {row.widget_kind && (
                      <p className="text-xs text-muted-foreground">{row.widget_kind.replace(/_/g, " ")}</p>
                    )}
                  </div>
                  <span className="text-sm font-mono shrink-0">{row.clicks.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
