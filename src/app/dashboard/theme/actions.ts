"use server";

import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { Theme } from "@/lib/themes";

export async function saveTheme(theme: Theme) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", session.user.id)
    .single();

  const { error } = await supabase
    .from("profiles")
    .update({ theme, updated_at: new Date().toISOString() })
    .eq("id", session.user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/theme");
  if (profile?.username) revalidatePath(`/${profile.username}`);
  return { ok: true };
}

export async function uploadBackground(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file selected" };
  if (file.size > 5 * 1024 * 1024) return { error: "File must be under 5MB" };
  if (!file.type.startsWith("image/")) return { error: "File must be an image or GIF" };

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop() || "png";
  const path = `${session.user.id}/bg-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("backgrounds")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage.from("backgrounds").getPublicUrl(path);

  return { ok: true, url: publicUrl };
}

export async function clearBackground() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("theme, username")
    .eq("id", session.user.id)
    .single();

  const theme = (profile?.theme as Record<string, unknown>) ?? {};
  delete theme.bg_image_url;

  const { error } = await supabase
    .from("profiles")
    .update({ theme })
    .eq("id", session.user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/theme");
  if (profile?.username) revalidatePath(`/${profile.username}`);
  return { ok: true };
}
