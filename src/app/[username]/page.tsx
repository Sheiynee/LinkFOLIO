import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProfileRender, type ProfileRenderData } from "@/components/profile-render";
import { ProfileCanvasRender } from "@/components/profile-canvas-render";
import { RevalidateOnFocus } from "@/components/revalidate-on-focus";
import { normalizeTheme } from "@/lib/themes";
import { collectUserFontIds } from "@/lib/typography";
import { getUserFontsByIds } from "@/lib/user-fonts";
import type { LayoutMode } from "@/lib/elements";
import { loadWidgetData } from "@/lib/widgets/load";
import { getProfileByUsername } from "@/lib/db/profiles";
import { getBlocksByUserId } from "@/lib/db/blocks";
import { getElementsByUserId } from "@/lib/db/elements";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const BOT_REGEX = /bot|crawler|spider|crawling|preview|facebookexternalhit|whatsapp|slackbot|discordbot|twitterbot/i;

interface Props {
  params: { username: string };
}

async function trackPageView(profileId: string) {
  const headerList = headers();
  const ua = headerList.get("user-agent") ?? "";
  if (BOT_REGEX.test(ua)) return;

  void createAdminClient()
    .from("page_views")
    .insert({ profile_id: profileId, referrer: headerList.get("referer") })
    .then(() => {});
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await getProfileByUsername(params.username);
  if (!profile || profile.deleted_at) return { title: "Not found — LinkFolio" };
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
  const profile = await getProfileByUsername(params.username);
  // Soft-deleted profiles read as 404 until the grace period ends.
  if (!profile || profile.deleted_at) notFound();

  await trackPageView(profile.id);

  const layoutMode = (profile.layout_mode as LayoutMode) ?? "stack";
  const [blocks, elements] = await Promise.all([
    layoutMode !== "canvas" ? getBlocksByUserId(profile.id, true) : Promise.resolve([]),
    layoutMode === "canvas" ? getElementsByUserId(profile.id, true) : Promise.resolve([]),
  ]);

  const theme = normalizeTheme(profile.theme);
  const carriers = layoutMode === "canvas" ? elements : blocks;
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
    blocks,
    verified: profile.verified ?? false,
  };

  const hasLiveWidget = carriers.some(
    (b) => b.widget_kind === "twitch_live" || b.widget_kind === "youtube_live"
  );

  return (
    <main className="min-h-screen">
      {layoutMode === "canvas" ? (
        <>
          <div className="hidden sm:block">
            <ProfileCanvasRender
              profile={renderData}
              elements={elements}
              theme={theme}
              widgetData={widgetData}
              userFonts={userFonts}
              view="desktop"
            />
          </div>
          <div className="block sm:hidden">
            <ProfileCanvasRender
              profile={renderData}
              elements={elements}
              theme={theme}
              widgetData={widgetData}
              userFonts={userFonts}
              view="mobile"
            />
          </div>
        </>
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
