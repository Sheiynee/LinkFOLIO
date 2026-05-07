import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProfileRender, type ProfileRenderData } from "@/components/profile-render";
import { normalizeTheme } from "@/lib/themes";
import type { Block } from "@/lib/blocks";
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
    .select("id, type, title, url, content, visible")
    .eq("user_id", profile.id)
    .eq("visible", true)
    .order("position", { ascending: true });

  return { ...profile, blocks: (blocks ?? []) as Block[] };
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
  return {
    title: `${name} — LinkFolio`,
    description: profile.bio ?? `${name}'s personal page on LinkFolio`,
    openGraph: {
      title: `${name} on LinkFolio`,
      description: profile.bio ?? `Links and more from ${name}`,
      images: profile.avatar_url ? [profile.avatar_url] : undefined,
    },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const profile = await getProfile(params.username);
  if (!profile) notFound();

  await trackPageView(profile.id);

  const theme = normalizeTheme(profile.theme);
  const data: ProfileRenderData = {
    username: profile.username,
    display_name: profile.display_name,
    bio: profile.bio,
    avatar_url: profile.avatar_url,
    blocks: profile.blocks,
  };

  return (
    <main className="min-h-screen">
      <ProfileRender profile={data} theme={theme} />
    </main>
  );
}
