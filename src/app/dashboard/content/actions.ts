"use server";

import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { type BlockType, normalizeUrl } from "@/lib/blocks";

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
  return { ok: true };
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
  return { ok: true };
}
