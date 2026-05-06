import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";

interface Props {
  params: { username: string };
}

// Dynamic OG meta per user
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = params;
  return {
    title: `${username} — LinkFolio`,
    description: `Check out ${username}'s personal page on LinkFolio`,
    openGraph: {
      title: `${username} on LinkFolio`,
      description: `Links, projects, and more from ${username}`,
    },
  };
}

// Placeholder — will be replaced with real Supabase fetch
async function getProfile(username: string) {
  return {
    name: username,
    bio: "Welcome to my LinkFolio page! I'll add my links soon.",
    avatar: null as string | null,
    links: [] as { id: string; title: string; url: string }[],
    theme: "purple" as const,
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = params;
  const profile = await getProfile(username);

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-950 to-slate-900 flex flex-col items-center py-16 px-4">
      {/* Avatar */}
      <Avatar className="h-24 w-24 mb-4 ring-4 ring-purple-500/40">
        <AvatarImage src={profile.avatar ?? ""} />
        <AvatarFallback className="text-3xl bg-purple-800 text-white">
          {profile.name[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Name + username */}
      <h1 className="text-2xl font-bold text-white mb-1">{profile.name}</h1>
      <Badge className="mb-4 bg-purple-900/60 text-purple-200 border-purple-700">
        @{username}
      </Badge>

      {/* Bio */}
      <p className="text-slate-300 text-center max-w-sm mb-8">{profile.bio}</p>

      {/* Links */}
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

      {/* Footer branding */}
      <p className="mt-12 text-slate-600 text-xs">
        Powered by <span className="text-purple-400 font-medium">LinkFolio</span>
      </p>
    </main>
  );
}
