"use server";

import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { isReservedUsername } from "@/lib/reserved-usernames";
import { validateImageFile } from "@/lib/image-magic";
import { addStorageUsage, ensureStorageHeadroom } from "@/lib/storage-quota";
import { rateLimit, RL_UPLOAD } from "@/lib/rate-limit";

export async function checkUsernameAvailable(username: string) {
  const session = await auth();
  if (!session?.user?.id) return { available: false, reason: "Not authenticated" };

  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,30}$/.test(normalized)) {
    return { available: false, reason: "3-30 chars: a-z, 0-9, _ or -" };
  }

  if (await isReservedUsername(normalized)) {
    return { available: false, reason: "Reserved" };
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

  if (await isReservedUsername(username)) {
    return { error: "That username is reserved" };
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

  const rl = await rateLimit(session.user.id, RL_UPLOAD);
  if (!rl.allowed) return { error: `Too many uploads. Try again in ${rl.retryAfterSeconds}s.` };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file selected" };
  if (file.size > 2 * 1024 * 1024) return { error: "File must be under 2MB" };

  const quota = await ensureStorageHeadroom(session.user.id, file.size);
  if (!quota.ok) return { error: quota.reason };

  const validated = await validateImageFile(file);
  if (!validated.ok) return { error: validated.reason };

  const supabase = createAdminClient();
  const path = `${session.user.id}/avatar-${Date.now()}.${validated.ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type || `image/${validated.ext}` });
  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
  await addStorageUsage(session.user.id, file.size);

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", session.user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { ok: true, url: publicUrl };
}
