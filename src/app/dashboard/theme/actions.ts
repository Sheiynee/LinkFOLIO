"use server";

import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { normalizeTheme, type Theme } from "@/lib/themes";
import { sanitizeFamilyName } from "@/lib/typography";
import { getUserFontUsageBytes } from "@/lib/user-fonts";
import { validateImageFile } from "@/lib/image-magic";
import { addStorageUsage, cleanupReplacedUploads, ensureStorageHeadroom, subtractStorageUsage } from "@/lib/storage-quota";
import { rateLimit, RL_UPLOAD } from "@/lib/rate-limit";
import { revalidatePublicPage } from "@/lib/revalidate";

const MAX_FONT_BYTES = 1024 * 1024; // 1 MB per file (woff2)
const USER_FONT_QUOTA_BYTES = 5 * 1024 * 1024; // 5 MB total per user
const WOFF2_MAGIC = [0x77, 0x4f, 0x46, 0x32]; // "wOF2"

const MAX_BG_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

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

  revalidatePath("/dashboard/theme");
  await revalidatePublicPage(session.user.id);
  return { ok: true };
}

export async function uploadUserFont(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const rl = await rateLimit(session.user.id, RL_UPLOAD);
  if (!rl.allowed) return { error: `Too many uploads. Try again in ${rl.retryAfterSeconds}s.` };

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

  // Per-user font quota (5MB across woff2 files) and global storage quota.
  const used = await getUserFontUsageBytes(session.user.id);
  if (used + file.size > USER_FONT_QUOTA_BYTES) {
    return { error: "Font storage quota reached. Delete an existing font first." };
  }
  const headroom = await ensureStorageHeadroom(session.user.id, file.size);
  if (!headroom.ok) return { error: headroom.reason };

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

  await addStorageUsage(session.user.id, file.size);

  revalidatePath("/dashboard/theme");
  return { ok: true, font: inserted };
}

export async function uploadBackgroundImage(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const rl = await rateLimit(session.user.id, RL_UPLOAD);
  if (!rl.allowed) return { error: `Too many uploads. Try again in ${rl.retryAfterSeconds}s.` };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file selected" };
  if (file.size > MAX_BG_IMAGE_BYTES) return { error: "Image must be under 5MB" };

  const quota = await ensureStorageHeadroom(session.user.id, file.size);
  if (!quota.ok) return { error: quota.reason };

  const validated = await validateImageFile(file);
  if (!validated.ok) return { error: validated.reason };

  const supabase = createAdminClient();
  const path = `${session.user.id}/bg-${Date.now()}.${validated.ext}`;

  const { error: uploadError } = await supabase.storage
    .from("backgrounds")
    .upload(path, file, { upsert: true, contentType: file.type || `image/${validated.ext}` });
  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage.from("backgrounds").getPublicUrl(path);
  await addStorageUsage(session.user.id, file.size);

  // Reclaim space from background images no longer referenced by the theme.
  // The 24h grace window protects files that were just uploaded but not yet
  // saved into a layer; theme JSON is matched by filename.
  const { data: prof } = await supabase
    .from("profiles")
    .select("theme")
    .eq("id", session.user.id)
    .maybeSingle();
  const themeJson = JSON.stringify(prof?.theme ?? {});
  await cleanupReplacedUploads({
    userId: session.user.id,
    bucket: "backgrounds",
    filePrefix: "bg-",
    keep: (name) => path.endsWith(name) || themeJson.includes(name),
    minAgeMs: 24 * 60 * 60 * 1000,
  });

  return { ok: true, url: publicUrl };
}

export async function deleteUserFont(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  const { data: row, error: lookupError } = await supabase
    .from("user_fonts")
    .select("storage_path, user_id, size_bytes")
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

  await subtractStorageUsage(session.user.id, Number(row.size_bytes ?? 0));

  revalidatePath("/dashboard/theme");
  await revalidatePublicPage(session.user.id);
  return { ok: true };
}
