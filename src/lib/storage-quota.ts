import { createAdminClient } from "./supabase/admin";

/**
 * Per-user storage cap across every upload path (avatars, backgrounds,
 * element-images, custom fonts). The `user_storage` table holds the running
 * total — uploads incrementally bump it and account deletion zeroes it. We
 * don't try to rebuild from storage listings on every check; if the counter
 * drifts (e.g. an orphaned upload) the worst case is a slightly conservative
 * quota, never an over-allocation.
 */
export const STORAGE_QUOTA_BYTES = 50 * 1024 * 1024; // 50 MB

export interface QuotaState {
  bytesUsed: number;
  bytesAvailable: number;
  quotaBytes: number;
  percentUsed: number;
}

export async function getUserStorageUsage(userId: string): Promise<QuotaState> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("user_storage")
    .select("bytes_used")
    .eq("user_id", userId)
    .maybeSingle();
  const bytesUsed = Number(data?.bytes_used ?? 0);
  return {
    bytesUsed,
    bytesAvailable: Math.max(0, STORAGE_QUOTA_BYTES - bytesUsed),
    quotaBytes: STORAGE_QUOTA_BYTES,
    percentUsed: Math.min(100, Math.round((bytesUsed / STORAGE_QUOTA_BYTES) * 100)),
  };
}

/**
 * Block an upload before it starts when the user is at or past their quota.
 * Returns `{ ok: false, reason }` with a friendly message when the upload
 * would put them over the cap.
 */
export async function ensureStorageHeadroom(
  userId: string,
  incomingBytes: number
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { bytesUsed } = await getUserStorageUsage(userId);
  if (bytesUsed + incomingBytes > STORAGE_QUOTA_BYTES) {
    const mb = (STORAGE_QUOTA_BYTES / 1024 / 1024).toFixed(0);
    return { ok: false, reason: `Storage limit reached (${mb}MB). Remove an existing upload to free space.` };
  }
  return { ok: true };
}

/**
 * Add `bytes` to the user's storage counter. Upserts the row if it doesn't
 * exist yet. Failures here are swallowed because the upload itself already
 * succeeded — the worst case is a stale counter, not a broken upload.
 */
export async function addStorageUsage(userId: string, bytes: number): Promise<void> {
  if (bytes <= 0) return;
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("user_storage")
    .select("bytes_used")
    .eq("user_id", userId)
    .maybeSingle();
  const next = Number(existing?.bytes_used ?? 0) + bytes;
  await supabase
    .from("user_storage")
    .upsert(
      { user_id: userId, bytes_used: next, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
}

export async function subtractStorageUsage(userId: string, bytes: number): Promise<void> {
  if (bytes <= 0) return;
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("user_storage")
    .select("bytes_used")
    .eq("user_id", userId)
    .maybeSingle();
  const next = Math.max(0, Number(existing?.bytes_used ?? 0) - bytes);
  await supabase
    .from("user_storage")
    .upsert(
      { user_id: userId, bytes_used: next, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
}
