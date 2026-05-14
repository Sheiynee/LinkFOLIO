import "server-only";
import type { DiscordInviteData } from "./types";

interface RawInvite {
  code: string;
  guild?: {
    name: string;
    icon: string | null;
    id: string;
  };
  approximate_member_count?: number;
  approximate_presence_count?: number;
}

export async function getDiscordInvite(code: string): Promise<DiscordInviteData | null> {
  const trimmed = code.trim();
  if (!/^[a-zA-Z0-9-]{2,20}$/.test(trimmed)) return null;

  const url = `https://discord.com/api/v10/invites/${trimmed}?with_counts=true`;
  const res = await fetch(url, {
    next: { revalidate: 60 * 5, tags: ["discord"] },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as RawInvite;
  if (!data.guild) return null;

  const icon = data.guild.icon
    ? `https://cdn.discordapp.com/icons/${data.guild.id}/${data.guild.icon}.png?size=128`
    : null;

  return {
    guild: { name: data.guild.name, icon_url: icon },
    approximate_member_count: data.approximate_member_count ?? null,
    approximate_presence_count: data.approximate_presence_count ?? null,
    invite_code: data.code,
  };
}

export function parseDiscordInvite(input: string): string | null {
  const m = input.trim().match(/(?:discord\.gg\/|discord\.com\/invite\/)([a-zA-Z0-9-]{2,20})/i);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-]{2,20}$/.test(input.trim())) return input.trim();
  return null;
}
