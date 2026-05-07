import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeEditor } from "./theme-editor";
import { normalizeTheme } from "@/lib/themes";
import type { Block } from "@/lib/blocks";

export default async function ThemePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, bio, avatar_url, theme")
    .eq("id", session.user.id)
    .single();
  if (!profile) redirect("/dashboard");

  const { data: blocks } = await supabase
    .from("blocks")
    .select("id, type, title, url, content")
    .eq("user_id", session.user.id)
    .order("position", { ascending: true });

  const theme = normalizeTheme(profile.theme);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-6 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/dashboard" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="font-bold text-lg">Theme</span>
      </header>
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Customize your page</h1>
          <p className="text-muted-foreground text-sm">
            Pick a preset or build your own. Changes preview live on the right.
          </p>
        </div>
        <ThemeEditor
          initialTheme={theme}
          profile={{
            username: profile.username,
            display_name: profile.display_name,
            bio: profile.bio,
            avatar_url: profile.avatar_url,
            blocks: (blocks ?? []) as Block[],
          }}
        />
      </div>
    </main>
  );
}
