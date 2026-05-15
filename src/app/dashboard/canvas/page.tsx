import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CanvasEditor } from "./canvas-editor";
import { normalizeTheme } from "@/lib/themes";
import { collectUserFontIds } from "@/lib/typography";
import { getUserFontsByIds } from "@/lib/user-fonts";
import { loadWidgetData } from "@/lib/widgets/load";
import type { Element, LayoutMode } from "@/lib/elements";

export const dynamic = "force-dynamic";

export default async function CanvasEditorPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, bio, avatar_url, theme, layout_mode")
    .eq("id", session.user.id)
    .single();
  if (!profile) redirect("/dashboard");

  const layoutMode = (profile.layout_mode as LayoutMode) ?? "stack";

  if (layoutMode !== "canvas") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold">Canvas mode is off</h1>
          <p className="text-sm text-muted-foreground">
            Your page is currently in stacked-column mode. Switch to canvas
            mode from the dashboard to drag, position, and resize elements
            freely.
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <Button render={<Link href="/dashboard" />}>Back to dashboard</Button>
          </div>
        </Card>
      </main>
    );
  }

  const { data: elements } = await supabase
    .from("elements")
    .select("id, type, title, url, content, visible, widget_kind, meta, x, y, w, h, rotation, z, locked")
    .eq("user_id", session.user.id)
    .order("z", { ascending: true });
  const list = (elements ?? []) as Element[];

  const theme = normalizeTheme(profile.theme);
  const fontIds = collectUserFontIds(theme.typography, list);
  const [widgetData, userFonts] = await Promise.all([
    loadWidgetData(list),
    getUserFontsByIds(fontIds),
  ]);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-6 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/dashboard" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="font-bold text-lg">Canvas</span>
        <span className="text-xs text-muted-foreground ml-auto">
          Drag elements to position. Click to select, Delete to remove.
        </span>
      </header>
      <div className="max-w-6xl mx-auto px-6 py-6">
        <CanvasEditor
          initialElements={list}
          profile={{
            username: profile.username,
            display_name: profile.display_name,
            bio: profile.bio,
            avatar_url: profile.avatar_url,
            blocks: [],
          }}
          theme={theme}
          widgetData={widgetData}
          userFonts={userFonts}
        />
      </div>
    </main>
  );
}
