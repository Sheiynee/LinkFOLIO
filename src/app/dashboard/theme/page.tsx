import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeEditor } from "./theme-editor";
import { normalizeTheme } from "@/lib/themes";
import type { Block } from "@/lib/blocks";
import type { WidgetData } from "@/lib/widgets/types";
import { getTwitchLiveStatus, getTwitchLatestVod } from "@/lib/widgets/twitch";
import { getYouTubeChannel, getYouTubeLatestVideo, getYouTubeLiveStatus } from "@/lib/widgets/youtube";
import { getGitHubRepo, getGitHubUser } from "@/lib/widgets/github";
import { getDiscordInvite } from "@/lib/widgets/discord";
import { fetchOgCard } from "@/lib/widgets/og-scraper";
import { getUserFontsForUser } from "@/lib/user-fonts";

async function loadPreviewWidgetData(blocks: Block[]): Promise<Record<string, WidgetData>> {
  const widgetBlocks = blocks.filter((b) => b.type === "widget");
  if (widgetBlocks.length === 0) return {};
  const entries = await Promise.all(
    widgetBlocks.map(async (block): Promise<[string, WidgetData] | null> => {
      const meta = (block.meta ?? {}) as Record<string, string>;
      if (block.widget_kind === "twitch_live" && meta.channel) {
        return [block.id, { kind: "twitch_live", data: await getTwitchLiveStatus(meta.channel) }];
      }
      if (block.widget_kind === "twitch_vod" && meta.channel) {
        return [block.id, { kind: "twitch_vod", data: await getTwitchLatestVod(meta.channel) }];
      }
      if (block.widget_kind === "youtube_channel") {
        return [block.id, { kind: "youtube_channel", data: await getYouTubeChannel(meta) }];
      }
      if (block.widget_kind === "youtube_video") {
        return [block.id, { kind: "youtube_video", data: await getYouTubeLatestVideo(meta) }];
      }
      if (block.widget_kind === "youtube_live") {
        return [block.id, { kind: "youtube_live", data: await getYouTubeLiveStatus(meta) }];
      }
      if (block.widget_kind === "github_repo" && meta.owner && meta.repo) {
        return [block.id, { kind: "github_repo", data: await getGitHubRepo(meta.owner, meta.repo) }];
      }
      if (block.widget_kind === "github_user" && meta.username) {
        return [block.id, { kind: "github_user", data: await getGitHubUser(meta.username) }];
      }
      if (block.widget_kind === "discord_invite" && meta.invite_code) {
        return [block.id, { kind: "discord_invite", data: await getDiscordInvite(meta.invite_code) }];
      }
      if (block.widget_kind === "og_card" && meta.url) {
        return [block.id, { kind: "og_card", data: await fetchOgCard(meta.url) }];
      }
      if (block.widget_kind === "tip_jar") return [block.id, { kind: "tip_jar", data: null }];
      if (block.widget_kind === "spotify_embed") return [block.id, { kind: "spotify_embed", data: null }];
      if (block.widget_kind === "tiktok_video") return [block.id, { kind: "tiktok_video", data: null }];
      return null;
    })
  );
  return Object.fromEntries(entries.filter((e): e is [string, WidgetData] => e !== null));
}

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
    .select("id, type, title, url, content, widget_kind, meta")
    .eq("user_id", session.user.id)
    .order("position", { ascending: true });

  const theme = normalizeTheme(profile.theme);
  const [widgetData, userFonts] = await Promise.all([
    loadPreviewWidgetData((blocks ?? []) as Block[]),
    getUserFontsForUser(session.user.id),
  ]);

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
          widgetData={widgetData}
          initialUserFonts={userFonts}
        />
      </div>
    </main>
  );
}
