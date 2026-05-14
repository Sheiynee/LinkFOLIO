"use server";

import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { type BlockType, normalizeUrl } from "@/lib/blocks";
import type { WidgetKind } from "@/lib/widgets/types";
import { parseTwitchChannel } from "@/lib/widgets/twitch";
import { parseYouTubeUrl } from "@/lib/widgets/youtube";
import { detectWidgetFromUrl } from "@/lib/widgets/detect";

async function revalidatePublicPage(userId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();
  if (data?.username) revalidatePath(`/${data.username}`);
}

interface CreateInput {
  type: BlockType;
  title?: string;
  url?: string;
  content?: string;
}

export async function createBlock(input: CreateInput) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();

  let title: string | null = null;
  let url: string | null = null;
  let content: string | null = null;

  if (input.type === "link") {
    title = (input.title ?? "").trim();
    const rawUrl = (input.url ?? "").trim();
    if (!title || !rawUrl) return { error: "Title and URL are required" };
    url = normalizeUrl(rawUrl);
    if (!url) return { error: "Invalid URL" };
  } else if (input.type === "text" || input.type === "heading") {
    content = (input.content ?? "").trim();
    if (!content) return { error: "Content is required" };
  }

  const { data: maxRow } = await supabase
    .from("blocks")
    .select("position")
    .eq("user_id", session.user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (maxRow?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("blocks")
    .insert({ user_id: session.user.id, type: input.type, position, title, url, content })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/dashboard/content");
  revalidatePath("/dashboard");
  await revalidatePublicPage(session.user.id);
  return { ok: true, id: data!.id };
}

interface UpdateInput {
  id: string;
  title?: string;
  url?: string;
  content?: string;
}

export async function updateBlock(input: UpdateInput) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("blocks")
    .select("type")
    .eq("id", input.id)
    .eq("user_id", session.user.id)
    .single();
  if (!existing) return { error: "Not found" };

  const patch: Record<string, string | null> = {};
  if (existing.type === "link") {
    const title = (input.title ?? "").trim();
    const rawUrl = (input.url ?? "").trim();
    if (!title || !rawUrl) return { error: "Title and URL are required" };
    const url = normalizeUrl(rawUrl);
    if (!url) return { error: "Invalid URL" };
    patch.title = title;
    patch.url = url;
  } else if (existing.type === "text" || existing.type === "heading") {
    const content = (input.content ?? "").trim();
    if (!content) return { error: "Content is required" };
    patch.content = content;
  }

  const { error } = await supabase
    .from("blocks")
    .update(patch)
    .eq("id", input.id)
    .eq("user_id", session.user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/content");
  revalidatePath("/dashboard");
  await revalidatePublicPage(session.user.id);
  return { ok: true };
}

export async function toggleBlockVisibility(id: string, visible: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("blocks")
    .update({ visible })
    .eq("id", id)
    .eq("user_id", session.user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/content");
  revalidatePath("/dashboard");
  await revalidatePublicPage(session.user.id);
  return { ok: true };
}

export async function deleteBlock(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("id", id)
    .eq("user_id", session.user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/content");
  revalidatePath("/dashboard");
  await revalidatePublicPage(session.user.id);
  return { ok: true };
}

type ResolveResult =
  | { kind: WidgetKind; meta: Record<string, unknown>; title: string | null }
  | { error: string };

function resolveWidget(kind: WidgetKind | "auto", input: string): ResolveResult {
  const trimmed = input.trim();
  if (!trimmed) return { error: "Enter a URL or handle" };

  if (kind === "auto") {
    const detected = detectWidgetFromUrl(trimmed);
    if (!detected) return { error: "Couldn't recognize that URL — pick a widget type below" };
    return { kind: detected.kind, meta: detected.meta, title: detected.label };
  }

  if (kind === "twitch_live") {
    const channel = parseTwitchChannel(trimmed) ?? trimmed.toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,25}$/.test(channel)) {
      return { error: "Enter a Twitch channel name or twitch.tv URL" };
    }
    return { kind, meta: { channel }, title: channel };
  }

  if (kind === "youtube_channel") {
    const yt = parseYouTubeUrl(trimmed);
    if (yt?.kind === "youtube_channel") {
      return {
        kind,
        meta: yt.channel_id ? { channel_id: yt.channel_id } : { handle: yt.handle },
        title: yt.handle ? `@${yt.handle}` : "YouTube channel",
      };
    }
    if (/^@?[a-zA-Z0-9._-]+$/.test(trimmed)) {
      const handle = trimmed.replace(/^@/, "");
      return { kind, meta: { handle }, title: `@${handle}` };
    }
    return { error: "Enter a YouTube channel URL or @handle" };
  }

  if (kind === "youtube_video") {
    const yt = parseYouTubeUrl(trimmed);
    if (yt?.kind === "youtube_video") {
      return { kind, meta: { video_id: yt.video_id }, title: "YouTube video" };
    }
    if (yt?.kind === "youtube_channel") {
      return {
        kind,
        meta: yt.channel_id ? { channel_id: yt.channel_id } : { handle: yt.handle },
        title: "Latest from " + (yt.handle ? `@${yt.handle}` : "YouTube"),
      };
    }
    return { error: "Enter a YouTube video URL or channel" };
  }

  return { error: "Widget kind not implemented yet" };
}

interface CreateWidgetInput {
  kind: WidgetKind | "auto";
  input: string;
}

export async function createWidgetBlock({ kind, input }: CreateWidgetInput) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const resolved = resolveWidget(kind, input);
  if ("error" in resolved) return resolved;
  const { kind: finalKind, meta, title } = resolved;

  const supabase = createAdminClient();
  const { data: maxRow } = await supabase
    .from("blocks")
    .select("position")
    .eq("user_id", session.user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (maxRow?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("blocks")
    .insert({
      user_id: session.user.id,
      type: "widget",
      widget_kind: finalKind,
      position,
      title,
      meta,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/dashboard/content");
  revalidatePath("/dashboard");
  await revalidatePublicPage(session.user.id);
  return { ok: true, id: data!.id };
}

export async function reorderBlocks(orderedIds: string[]) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  const updates = orderedIds.map((id, index) =>
    supabase
      .from("blocks")
      .update({ position: index })
      .eq("id", id)
      .eq("user_id", session.user.id!)
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  revalidatePath("/dashboard/content");
  revalidatePath("/dashboard");
  await revalidatePublicPage(session.user.id);
  return { ok: true };
}
