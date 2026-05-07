"use server";

import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function checkUsernameAvailable(username: string) {
  const session = await auth();
  if (!session?.user?.id) return { available: false, reason: "Not authenticated" };

  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,30}$/.test(normalized)) {
    return { available: false, reason: "3-30 chars: a-z, 0-9, _ or -" };
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", normalized)
    .neq("id", session.user.id)
    .maybeSingle();

  if (data) return { available: false, reason: "Already taken" };
  return { available: true };
}

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const display_name = String(formData.get("display_name") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;

  if (!/^[a-z0-9_-]{3,30}$/.test(username)) {
    return { error: "Username must be 3-30 chars: a-z, 0-9, _ or -" };
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", session.user.id)
    .maybeSingle();
  if (existing) return { error: "Username already taken" };

  const { error } = await supabase
    .from("profiles")
    .update({ username, display_name, bio, updated_at: new Date().toISOString() })
    .eq("id", session.user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/${username}`);
  return { ok: true, username };
}

export async function uploadAvatar(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file selected" };
  if (file.size > 2 * 1024 * 1024) return { error: "File must be under 2MB" };
  if (!file.type.startsWith("image/")) return { error: "File must be an image" };

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop() || "png";
  const path = `${session.user.id}/avatar-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", session.user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { ok: true, url: publicUrl };
}
