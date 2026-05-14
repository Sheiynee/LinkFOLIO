import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Settings, Plus, Palette, Eye, MousePointerClick, Sparkles } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Block } from "@/lib/blocks";
import { BLOCK_LABELS } from "@/lib/blocks";
import { OnboardingChecklist } from "./onboarding-checklist";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, theme")
    .eq("id", session.user.id)
    .single();

  if (!profile) redirect("/auth/signin");

  const [{ data: blocks }, viewsRes, clicksRes] = await Promise.all([
    supabase
      .from("blocks")
      .select("id, type, title, url, content, visible")
      .eq("user_id", session.user.id)
      .order("position", { ascending: true }),
    supabase
      .from("page_views")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", session.user.id),
    supabase
      .from("block_clicks")
      .select("block_id, blocks!inner(user_id)", { count: "exact", head: true })
      .eq("blocks.user_id", session.user.id),
  ]);

  const blockList = (blocks ?? []) as Block[];
  const blockCount = blockList.length;
  const linkCount = blockList.filter((b) => b.type === "link").length;
  const visibleCount = blockList.filter((b) => b.visible !== false).length;
  const totalViews = viewsRes.count ?? 0;
  const totalClicks = clicksRes.count ?? 0;
  const displayName = profile.display_name ?? session.user.name ?? profile.username;

  const themeJson = profile.theme as Record<string, unknown> | null;
  const hasCustomized = !!(
    themeJson &&
    (themeJson.preset !== "glass" || themeJson.bg_image_url)
  );

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <span className="font-bold text-lg">LinkFolio</span>
        <div className="flex items-center gap-3">
          <Link
            href={`/${profile.username}`}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            target="_blank"
          >
            <ExternalLink className="h-4 w-4" />
            View page
          </Link>
          <ThemeToggle />
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile.avatar_url ?? session.user.image ?? ""} />
            <AvatarFallback>{displayName?.[0] ?? "U"}</AvatarFallback>
          </Avatar>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Your page is live at{" "}
            <Link
              href={`/${profile.username}`}
              className="text-purple-600 dark:text-purple-400 font-mono hover:underline"
            >
              /{profile.username}
            </Link>
          </p>
        </div>

        {blockCount === 0 && (
          <Card className="border-foreground/20 bg-gradient-to-br from-purple-500/5 to-pink-500/5">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" /> Quick start
                </CardTitle>
                <CardDescription>
                  Build a populated page in under 90 seconds — pick an archetype, paste your platform links, pick a color and font.
                </CardDescription>
              </div>
              <Button render={<Link href="/onboarding" />}>
                Start <Sparkles className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
          </Card>
        )}

        <OnboardingChecklist
          hasBlocks={blockCount > 0}
          hasCustomized={hasCustomized}
          hasView={totalViews > 0}
          username={profile.username}
        />

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                Page views
              </CardDescription>
              <CardTitle className="text-3xl">{totalViews.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <MousePointerClick className="h-3.5 w-3.5" />
                Link clicks
              </CardDescription>
              <CardTitle className="text-3xl">{totalClicks.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.avatar_url ?? session.user.image ?? ""} />
              <AvatarFallback className="text-2xl">{displayName?.[0] ?? "U"}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>{displayName}</CardTitle>
              <CardDescription>{session.user.email}</CardDescription>
              <Badge variant="secondary" className="mt-1">
                @{profile.username}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              render={<Link href="/dashboard/settings" />}
            >
              <Settings className="h-4 w-4 mr-1" /> Edit profile
            </Button>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Content</CardTitle>
              <CardDescription>
                {blockCount === 0
                  ? "No blocks yet — add your first one!"
                  : `${visibleCount} of ${blockCount} blocks visible · ${linkCount} link${linkCount === 1 ? "" : "s"}`}
              </CardDescription>
            </div>
            <Button size="sm" render={<Link href="/dashboard/content" />}>
              <Plus className="h-4 w-4 mr-1" /> Manage
            </Button>
          </CardHeader>
          {blockCount > 0 && (
            <CardContent>
              <ul className="space-y-1">
                {blockList.slice(0, 5).map((b) => (
                  <li key={b.id} className="flex justify-between text-sm gap-4">
                    <span className="font-medium truncate">
                      {b.type === "link"
                        ? b.title
                        : b.type === "divider"
                        ? "—"
                        : b.content}
                    </span>
                    <span className="text-muted-foreground text-xs uppercase tracking-wide shrink-0">
                      {BLOCK_LABELS[b.type]}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Theme</CardTitle>
              <CardDescription>Pick a preset or build your own look</CardDescription>
            </div>
            <Button variant="outline" size="sm" render={<Link href="/dashboard/theme" />}>
              <Palette className="h-4 w-4 mr-1" /> Customize
            </Button>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}
