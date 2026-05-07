import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";

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

  const { data: links } = await supabase
    .from("links")
    .select("id, title, url")
    .eq("user_id", profile.id)
    .order("position", { ascending: true });

  return { ...profile, links: links ?? [] };
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

  const name = profile.display_name ?? profile.username;

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-950 to-slate-900 flex flex-col items-center py-16 px-4">
      <Avatar className="h-24 w-24 mb-4 ring-4 ring-purple-500/40">
        <AvatarImage src={profile.avatar_url ?? ""} />
        <AvatarFallback className="text-3xl bg-purple-800 text-white">
          {name[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <h1 className="text-2xl font-bold text-white mb-1">{name}</h1>
      <Badge className="mb-4 bg-purple-900/60 text-purple-200 border-purple-700">
        @{profile.username}
      </Badge>

      {profile.bio && (
        <p className="text-slate-300 text-center max-w-sm mb-8">{profile.bio}</p>
      )}

      <div className="w-full max-w-sm space-y-3">
        {profile.links.length === 0 ? (
          <p className="text-slate-500 text-center text-sm">No links added yet.</p>
        ) : (
          profile.links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl px-5 py-3 text-white transition"
            >
              <span className="font-medium">{link.title}</span>
              <ExternalLink className="h-4 w-4 text-slate-400" />
            </a>
          ))
        )}
      </div>

      <p className="mt-12 text-slate-600 text-xs">
        Powered by <span className="text-purple-400 font-medium">LinkFolio</span>
      </p>
    </main>
  );
}
