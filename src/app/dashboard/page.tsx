import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Settings, Plus } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const { user } = session;
  const username = user.email?.split("@")[0] ?? "user";

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <span className="font-bold text-lg">LinkFolio</span>
        <div className="flex items-center gap-4">
          <Link
            href={`/${username}`}
            className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1"
            target="_blank"
          >
            <ExternalLink className="h-4 w-4" />
            View page
          </Link>
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image ?? ""} />
            <AvatarFallback>{user.name?.[0] ?? "U"}</AvatarFallback>
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
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-slate-500">
            Your page is live at{" "}
            <Link href={`/${username}`} className="text-purple-600 font-mono hover:underline">
              /{username}
            </Link>
          </p>
        </div>

        {/* Profile card */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.image ?? ""} />
              <AvatarFallback className="text-2xl">{user.name?.[0] ?? "U"}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>{user.name}</CardTitle>
              <CardDescription>{user.email}</CardDescription>
              <Badge className="mt-1 bg-purple-100 text-purple-700 hover:bg-purple-100">
                @{username}
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

        {/* Links section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Links</CardTitle>
              <CardDescription>Manage the links shown on your page</CardDescription>
            </div>
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
              render={<Link href="/dashboard/links" />}
            >
              <Plus className="h-4 w-4 mr-1" /> Add link
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400 text-sm">No links yet — add your first one!</p>
          </CardContent>
        </Card>

        {/* Themes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Theme</CardTitle>
              <CardDescription>Customize the look of your public page</CardDescription>
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
