import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Block } from "@/lib/blocks";

const BLOCK_FIELDS = "id, type, title, url, content, visible, widget_kind, meta";

export async function getBlocksByUserId(userId: string, onlyVisible = false): Promise<Block[]> {
  let query = createAdminClient()
    .from("blocks")
    .select(BLOCK_FIELDS)
    .eq("user_id", userId)
    .order("position", { ascending: true });
  if (onlyVisible) query = query.eq("visible", true);
  const { data } = await query;
  return (data ?? []) as Block[];
}
