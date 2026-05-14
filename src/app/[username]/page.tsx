import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProfileRender, type ProfileRenderData } from "@/components/profile-render";
import { normalizeTheme } from "@/lib/themes";
import type { Block } from "@/lib/blocks";
import type { WidgetData } from "@/lib/widgets/types";
import { getTwitchLiveStatus, getTwitchLatestVod } from "@/lib/widgets/twitch";
import { getYouTubeChannel, getYouTubeLatestVideo, getYouTubeLiveStatus } from "@/lib/widgets/youtube";
import { getGitHubRepo, getGitHubUser } from "@/lib/widgets/github";
import { getDiscordInvite } from "@/lib/widgets/discord";
import { fetchOgCard } from "@/lib/widgets/og-scraper";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const BOT_REGEX = /bot|crawler|spider|crawling|preview|facebookexternalhit|whatsapp|slackbot|discordbot|twitterbot/i;

interface Props {
  params: { username: string };
}

async function getProfile(username: string) {
  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, theme")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  if (!profile) return null;

  const { data: blocks } = await supabase
    .from("blocks")
    .select("id, type, title, url, content, visible, widget_kind, meta")
    .eq("user_id", profile.id)
    .eq("visible", true)
    .order("position", { ascending: true });

  return { ...profile, blocks: (blocks ?? []) as Block[] };
}

async function loadWidgetData(blocks: Block[]): Promise<Record<string, WidgetData>> {
  const widgetBlocks = blocks.filter((b) => b.type === "widget");
  if (widgetBlocks.length === 0) return {};

  const entries = await Promise.all(
    widgetBlocks.map(async (block): Promise<[string, WidgetData] | null> => {
      if (block.widget_kind === "twitch_live") {
        const channel = (block.meta as { channel?: string } | null)?.channel;
        if (!channel) return null;
        const data = await getTwitchLiveStatus(channel);
        return [block.id, { kind: "twitch_live", data }];
      }
      if (block.widget_kind === "twitch_vod") {
        const channel = (block.meta as { channel?: string } | null)?.channel;
        if (!channel) return null;
        const data = await getTwitchLatestVod(channel);
        return [block.id, { kind: "twitch_vod", data }];
      }
      if (block.widget_kind === "youtube_live") {
        const meta = (block.meta ?? {}) as { channel_id?: string; handle?: string };
        const data = await getYouTubeLiveStatus(meta);
        return [block.id, { kind: "youtube_live", data }];
      }
      if (block.widget_kind === "og_card") {
        const url = (block.meta as { url?: string } | null)?.url;
        if (!url) return null;
        const data = await fetchOgCard(url);
        return [block.id, { kind: "og_card", data }];
      }
      if (block.widget_kind === "youtube_channel") {
        const meta = (block.meta ?? {}) as { channel_id?: string; handle?: string };
        const data = await getYouTubeChannel(meta);
        return [block.id, { kind: "youtube_channel", data }];
      }
      if (block.widget_kind === "youtube_video") {
        const meta = (block.meta ?? {}) as { video_id?: string; channel_id?: string; handle?: string };
        const data = await getYouTubeLatestVideo(meta);
        return [block.id, { kind: "youtube_video", data }];
      }
      if (block.widget_kind === "github_repo") {
        const meta = (block.meta ?? {}) as { owner?: string; repo?: string };
        if (!meta.owner || !meta.repo) return null;
        const data = await getGitHubRepo(meta.owner, meta.repo);
        return [block.id, { kind: "github_repo", data }];
      }
      if (block.widget_kind === "github_user") {
        const meta = (block.meta ?? {}) as { username?: string };
        if (!meta.username) return null;
        const data = await getGitHubUser(meta.username);
        return [block.id, { kind: "github_user", data }];
      }
      if (block.widget_kind === "discord_invite") {
        const meta = (block.meta ?? {}) as { invite_code?: string };
        if (!meta.invite_code) return null;
        const data = await getDiscordInvite(meta.invite_code);
        return [block.id, { kind: "discord_invite", data }];
      }
      if (block.widget_kind === "tip_jar") {
        return [block.id, { kind: "tip_jar", data: null }];
      }
      if (block.widget_kind === "spotify_embed") {
        return [block.id, { kind: "spotify_embed", data: null }];
      }
      if (block.widget_kind === "tiktok_video") {
        return [block.id, { kind: "tiktok_video", data: null }];
      }
      return null;
    })
  );

  return Object.fromEntries(entries.filter((e): e is [string, WidgetData] => e !== null));
}

async function trackPageView(profileId: string) {
  const headerList = headers();
  const ua = headerList.get("user-agent") ?? "";
  if (BOT_REGEX.test(ua)) return;

  const supabase = createAdminClient();
  void supabase
    .from("page_views")
    .insert({
      profile_id: profileId,
      referrer: headerList.get("referer"),
    })
    .then(() => {});
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await getProfile(params.username);
  if (!profile) return { title: "Not found — LinkFolio" };
  const name = profile.display_name ?? profile.username;
  const ogImage = `/api/og/${profile.username}`;
  return {
    title: `${name} — LinkFolio`,
    description: profile.bio ?? `${name}'s personal page on LinkFolio`,
    openGraph: {
      title: `${name} on LinkFolio`,
      description: profile.bio ?? `Links and more from ${name}`,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} on LinkFolio`,
      description: profile.bio ?? `Links and more from ${name}`,
      images: [ogImage],
    },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const profile = await getProfile(params.username);
  if (!profile) notFound();

  await trackPageView(profile.id);

  const theme = normalizeTheme(profile.theme);
  const widgetData = await loadWidgetData(profile.blocks);
  const data: ProfileRenderData = {
    username: profile.username,
    display_name: profile.display_name,
    bio: profile.bio,
    avatar_url: profile.avatar_url,
    blocks: profile.blocks,
  };

  return (
    <main className="min-h-screen">
      <ProfileRender profile={data} theme={theme} widgetData={widgetData} />
    </main>
  );
}
