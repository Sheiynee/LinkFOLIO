"use server";

import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { detectWidgetFromUrl } from "@/lib/widgets/detect";
import { parseTipJarUrl } from "@/lib/widgets/tip-jar";
import { paletteFromSeed } from "@/lib/palette";
import { TYPE_PAIRINGS } from "@/lib/type-pairings";
import { PRESETS } from "@/lib/themes";
import { getArchetype, type ArchetypeId } from "@/lib/archetypes";
import type { FontId } from "@/lib/fonts";

async function revalidateUserPages(userId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/content");
  revalidatePath("/dashboard/theme");
  if (data?.username) revalidatePath(`/${data.username}`);
}

export async function applyOnboardingUrls({
  archetype,
  urls,
}: {
  archetype: ArchetypeId;
  urls: Record<string, string>;
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  const created: string[] = [];

  const { data: maxRow } = await supabase
    .from("blocks")
    .select("position")
    .eq("user_id", session.user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  let position = (maxRow?.position ?? -1) + 1;

  for (const [platformId, rawUrl] of Object.entries(urls)) {
    const url = rawUrl.trim();
    if (!url) continue;

    // For Ko-fi / Patreon / Streamlabs / BMaC we route through tip-jar
    // even if the user pasted just a username.
    const tipParsed = parseTipJarUrl(url);
    let resolved = detectWidgetFromUrl(url);
    if (!resolved && tipParsed) {
      resolved = {
        kind: "tip_jar",
        meta: { platform: tipParsed.platform, handle: tipParsed.handle },
        label: `Tip on ${tipParsed.platform}`,
      };
    }
    if (!resolved) continue;

    const { data, error } = await supabase
      .from("blocks")
      .insert({
        user_id: session.user.id,
        type: "widget",
        widget_kind: resolved.kind,
        position,
        title: resolved.label,
        meta: resolved.meta,
      })
      .select("id")
      .single();
    if (!error && data) {
      created.push(platformId);
      position += 1;
    }
  }

  await revalidateUserPages(session.user.id);
  return { ok: true, created };
}

export async function applyPaletteFromSeed(seedHex: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("theme")
    .eq("id", session.user.id)
    .single();

  const generated = paletteFromSeed(seedHex);
  const nextTheme = {
    ...(profile?.theme ?? PRESETS.glass),
    ...generated,
    preset: "custom",
  };

  const { error } = await supabase
    .from("profiles")
    .update({ theme: nextTheme })
    .eq("id", session.user.id);
  if (error) return { error: error.message };

  await revalidateUserPages(session.user.id);
  return { ok: true };
}

export async function applyTypePairing(pairingId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const pairing = TYPE_PAIRINGS.find((p) => p.id === pairingId);
  if (!pairing) return { error: "Unknown type pairing" };

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("theme")
    .eq("id", session.user.id)
    .single();

  const nextTheme = {
    ...(profile?.theme ?? PRESETS.glass),
    font: pairing.font as FontId,
  };

  const { error } = await supabase
    .from("profiles")
    .update({ theme: nextTheme })
    .eq("id", session.user.id);
  if (error) return { error: error.message };

  await revalidateUserPages(session.user.id);
  return { ok: true };
}

export async function applyArchetypePreset(archetype: ArchetypeId) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const arch = getArchetype(archetype);
  const preset = PRESETS[arch.defaultPreset];
  if (!preset) return { ok: true };

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("theme")
    .eq("id", session.user.id)
    .single();
  // Only apply the archetype preset if the user hasn't customized yet.
  const current = profile?.theme as { preset?: string } | null;
  if (current?.preset && current.preset !== "custom" && current.preset !== "glass") {
    return { ok: true };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ theme: preset })
    .eq("id", session.user.id);
  if (error) return { error: error.message };

  await revalidateUserPages(session.user.id);
  return { ok: true };
}
