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
  revalidatePath("/onboarding");
  if (data?.username) revalidatePath(`/${data.username}`);
}

/**
 * Check whether the user has already completed onboarding.
 * Used by both the /onboarding page (to surface "already done" guard)
 * and by applyOnboardingUrls (to dedupe widgets on re-run).
 */
export async function getOnboardingState() {
  const session = await auth();
  if (!session?.user?.id) return { signedIn: false as const };

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", session.user.id)
    .single();

  const { count } = await supabase
    .from("blocks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.user.id);

  return {
    signedIn: true as const,
    onboardedAt: profile?.onboarded_at ?? null,
    blockCount: count ?? 0,
  };
}

export async function applyOnboardingUrls({
  urls,
}: {
  archetype?: ArchetypeId;
  urls: Record<string, string>;
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  const created: string[] = [];

  // Pull existing widget meta so we can dedupe on re-run.
  const { data: existing } = await supabase
    .from("blocks")
    .select("widget_kind, meta")
    .eq("user_id", session.user.id)
    .eq("type", "widget");
  const existingKeys = new Set(
    (existing ?? []).map((row) => widgetDedupeKey(row.widget_kind, row.meta as Record<string, unknown> | null))
  );

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

    const key = widgetDedupeKey(resolved.kind, resolved.meta);
    if (existingKeys.has(key)) continue;

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
      existingKeys.add(key);
      position += 1;
    }
  }

  await revalidateUserPages(session.user.id);
  return { ok: true, created };
}

function widgetDedupeKey(kind: string | null | undefined, meta: Record<string, unknown> | null | undefined): string {
  if (!kind) return "";
  const m = meta ?? {};
  // Stable subset of identity-bearing fields per widget kind.
  const id =
    (m.channel as string) ||
    (m.channel_id as string) ||
    (m.handle as string) ||
    (m.username as string) ||
    (m.video_id as string) ||
    (m.owner && m.repo ? `${m.owner}/${m.repo}` : "") ||
    (m.invite_code as string) ||
    (m.url as string) ||
    (m.id as string) ||
    "";
  return `${kind}:${id.toLowerCase()}`;
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
  const base = (profile?.theme as Record<string, unknown> | null) ?? PRESETS.glass;
  const nextTheme = {
    ...base,
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

  const base = (profile?.theme as Record<string, unknown> | null) ?? PRESETS.glass;
  const nextTheme = {
    ...base,
    typography: pairing.roles,
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

/**
 * Marks the user's profile as having completed onboarding. Called from the
 * finish step in the flow. Idempotent — only sets the timestamp once.
 */
export async function markOnboardingComplete() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", session.user.id)
    .is("onboarded_at", null);

  await revalidateUserPages(session.user.id);
  return { ok: true };
}

/**
 * Used when the user skips every step: still applies the archetype preset
 * (so they don't land on a wholly default page) and marks onboarding done.
 */
export async function applySkipAllDefaults(archetype: ArchetypeId | null) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  if (archetype) {
    await applyArchetypePreset(archetype);
  }
  await markOnboardingComplete();
  return { ok: true };
}
