import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProfileRender, type ProfileRenderData } from "@/components/profile-render";
import { ProfileCanvasRender } from "@/components/profile-canvas-render";
import { RevalidateOnFocus } from "@/components/revalidate-on-focus";
import { normalizeTheme } from "@/lib/themes";
import { collectUserFontIds } from "@/lib/typography";
import { getUserFontsByIds } from "@/lib/user-fonts";
import type { Block } from "@/lib/blocks";
import type { Element, LayoutMode } from "@/lib/elements";
import { loadWidgetData } from "@/lib/widgets/load";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const BOT_REGEX = /bot|crawler|spider|crawling|preview|facebookexternalhit|whatsapp|slackbot|discordbot|twitterbot/i;

interface Props {
  params: { username: string };
}

interface LoadedProfile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  theme: unknown;
  layout_mode: LayoutMode;
  blocks: Block[];
  elements: Element[];
}

async function getProfile(username: string): Promise<LoadedProfile | null> {
  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, theme, layout_mode")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  if (!profile) return null;

  const layout_mode = (profile.layout_mode as LayoutMode) ?? "stack";

  if (layout_mode === "canvas") {
    const { data: elements } = await supabase
      .from("elements")
      .select("id, type, title, url, content, visible, widget_kind, meta, x, y, w, h, rotation, z, locked")
      .eq("user_id", profile.id)
      .eq("visible", true)
      .order("z", { ascending: true });
    return { ...profile, layout_mode, blocks: [], elements: (elements ?? []) as Element[] };
  }

  const { data: blocks } = await supabase
    .from("blocks")
    .select("id, type, title, url, content, visible, widget_kind, meta")
    .eq("user_id", profile.id)
    .eq("visible", true)
    .order("position", { ascending: true });
  return { ...profile, layout_mode, blocks: (blocks ?? []) as Block[], elements: [] };
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
  const carriers = profile.layout_mode === "canvas" ? profile.elements : profile.blocks;
  const fontIds = collectUserFontIds(theme.typography, carriers);
  const [widgetData, userFonts] = await Promise.all([
    loadWidgetData(carriers),
    getUserFontsByIds(fontIds),
  ]);

  const renderData: ProfileRenderData = {
    username: profile.username,
    display_name: profile.display_name,
    bio: profile.bio,
    avatar_url: profile.avatar_url,
    blocks: profile.blocks,
  };

  const hasLiveWidget = carriers.some(
    (b) => b.widget_kind === "twitch_live" || b.widget_kind === "youtube_live"
  );

  return (
    <main className="min-h-screen">
      {profile.layout_mode === "canvas" ? (
        <ProfileCanvasRender
          profile={renderData}
          elements={profile.elements}
          theme={theme}
          widgetData={widgetData}
          userFonts={userFonts}
        />
      ) : (
        <ProfileRender
          profile={renderData}
          theme={theme}
          widgetData={widgetData}
          userFonts={userFonts}
        />
      )}
      {hasLiveWidget && <RevalidateOnFocus />}
    </main>
  );
}
