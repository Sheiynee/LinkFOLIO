"use server";

import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export async function createLink(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const title = String(formData.get("title") ?? "").trim();
  const rawUrl = String(formData.get("url") ?? "").trim();
  if (!title || !rawUrl) return { error: "Title and URL are required" };

  const url = normalizeUrl(rawUrl);
  if (!url) return { error: "Invalid URL" };

  const supabase = createAdminClient();
  const { data: maxRow } = await supabase
    .from("links")
    .select("position")
    .eq("user_id", session.user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (maxRow?.position ?? -1) + 1;

  const { error } = await supabase
    .from("links")
    .insert({ user_id: session.user.id, title, url, position });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/links");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateLink(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const rawUrl = String(formData.get("url") ?? "").trim();
  if (!id || !title || !rawUrl) return { error: "Missing fields" };

  const url = normalizeUrl(rawUrl);
  if (!url) return { error: "Invalid URL" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("links")
    .update({ title, url })
    .eq("id", id)
    .eq("user_id", session.user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/links");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteLink(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing id" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("links")
    .delete()
    .eq("id", id)
    .eq("user_id", session.user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/links");
  revalidatePath("/dashboard");
  return { ok: true };
}
