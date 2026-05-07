import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Settings, Plus } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, bio, avatar_url")
    .eq("id", session.user.id)
    .single();

  if (!profile) redirect("/auth/signin");

  const { data: links } = await supabase
    .from("links")
    .select("id, title, url")
    .eq("user_id", session.user.id)
    .order("position", { ascending: true });

  const linkCount = links?.length ?? 0;
  const displayName = profile.display_name ?? session.user.name ?? profile.username;

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
            <Link href={`/${profile.username}`} className="text-purple-600 dark:text-purple-400 font-mono hover:underline">
              /{profile.username}
            </Link>
          </p>
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
              <CardTitle>Links</CardTitle>
              <CardDescription>
                {linkCount === 0
                  ? "No links yet — add your first one!"
                  : `${linkCount} link${linkCount === 1 ? "" : "s"} on your page`}
              </CardDescription>
            </div>
            <Button size="sm" render={<Link href="/dashboard/links" />}>
              <Plus className="h-4 w-4 mr-1" /> Manage
            </Button>
          </CardHeader>
          {linkCount > 0 && (
            <CardContent>
              <ul className="space-y-1">
                {links!.slice(0, 5).map((l) => (
                  <li key={l.id} className="flex justify-between text-sm">
                    <span className="font-medium">{l.title}</span>
                    <span className="text-muted-foreground truncate ml-4 max-w-xs">{l.url}</span>
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
              Customize
            </Button>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}
