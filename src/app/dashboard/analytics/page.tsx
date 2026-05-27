import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAnalyticsData } from "./actions";
import { AnalyticsDashboard } from "./analytics-dashboard";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const result = await getAnalyticsData(7);
  const initial = "error" in result
    ? { viewsOverTime: [], totalViews: 0, totalClicks: 0, topReferrers: [], topCountries: [], widgetClicks: [] }
    : result;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-6 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/dashboard" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="font-bold text-lg">Analytics</span>
      </header>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <AnalyticsDashboard initial={initial} />
      </div>
    </main>
  );
}
