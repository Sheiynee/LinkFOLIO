"use server";

import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { normalizeTheme, type Theme } from "@/lib/themes";
import { sanitizeFamilyName } from "@/lib/typography";
import { getUserFontUsageBytes } from "@/lib/user-fonts";

const MAX_FONT_BYTES = 1024 * 1024; // 1 MB per file (woff2)
const USER_FONT_QUOTA_BYTES = 5 * 1024 * 1024; // 5 MB total per user
const WOFF2_MAGIC = [0x77, 0x4f, 0x46, 0x32]; // "wOF2"

async function getUsernameForUser(userId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();
  return data?.username ?? null;
}

export async function saveTheme(theme: Theme) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  // Re-normalize on the server so malformed client state can't corrupt the row.
  const safe = normalizeTheme(theme);

  const { error } = await supabase
    .from("profiles")
    .update({ theme: safe, updated_at: new Date().toISOString() })
    .eq("id", session.user.id);

  if (error) return { error: error.message };

  const username = await getUsernameForUser(session.user.id);
  revalidatePath("/dashboard/theme");
  if (username) revalidatePath(`/${username}`);
  return { ok: true };
}

export async function uploadUserFont(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const file = formData.get("file") as File | null;
  const rawName = (formData.get("family_name") as string | null) ?? "";
  if (!file || file.size === 0) return { error: "No file selected" };
  if (file.size > MAX_FONT_BYTES) return { error: "Font must be under 1MB" };

  // Magic-byte validation: woff2 only.
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.length < 4) return { error: "File is empty or corrupted" };
  if (
    buf[0] !== WOFF2_MAGIC[0] ||
    buf[1] !== WOFF2_MAGIC[1] ||
    buf[2] !== WOFF2_MAGIC[2] ||
    buf[3] !== WOFF2_MAGIC[3]
  ) {
    return { error: "Only WOFF2 fonts are supported (check the file extension)" };
  }

  const familyName = sanitizeFamilyName(rawName || file.name.replace(/\.woff2?$/i, ""));
  if (!familyName) return { error: "Font family name is required" };

  // Per-user quota.
  const used = await getUserFontUsageBytes(session.user.id);
  if (used + file.size > USER_FONT_QUOTA_BYTES) {
    return { error: "Font storage quota reached. Delete an existing font first." };
  }

  const supabase = createAdminClient();
  const path = `${session.user.id}/${Date.now()}-${familyName.replace(/\s+/g, "_")}.woff2`;

  const { error: uploadError } = await supabase.storage
    .from("fonts")
    .upload(path, buf, { upsert: false, contentType: "font/woff2" });
  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage.from("fonts").getPublicUrl(path);

  const { data: inserted, error: insertError } = await supabase
    .from("user_fonts")
    .insert({
      user_id: session.user.id,
      family_name: familyName,
      weight: 400,
      style: "normal",
      url: publicUrl,
      storage_path: path,
      size_bytes: file.size,
    })
    .select("id, family_name, weight, style, url")
    .single();

  if (insertError) {
    // Best-effort cleanup so a failed insert doesn't leave an orphan file.
    await supabase.storage.from("fonts").remove([path]);
    return { error: insertError.message };
  }

  revalidatePath("/dashboard/theme");
  return { ok: true, font: inserted };
}

export async function deleteUserFont(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  const { data: row, error: lookupError } = await supabase
    .from("user_fonts")
    .select("storage_path, user_id")
    .eq("id", id)
    .single();
  if (lookupError || !row) return { error: "Font not found" };
  if (row.user_id !== session.user.id) return { error: "Forbidden" };

  await supabase.storage.from("fonts").remove([row.storage_path]);
  const { error: deleteError } = await supabase
    .from("user_fonts")
    .delete()
    .eq("id", id);
  if (deleteError) return { error: deleteError.message };

  const username = await getUsernameForUser(session.user.id);
  revalidatePath("/dashboard/theme");
  if (username) revalidatePath(`/${username}`);
  return { ok: true };
}
