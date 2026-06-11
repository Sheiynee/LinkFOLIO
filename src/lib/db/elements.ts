import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Element } from "@/lib/elements";

const ELEMENT_FIELDS =
  "id, type, title, url, content, visible, widget_kind, meta, x, y, w, h, rotation, z, locked, mobile_x, mobile_y, mobile_w, mobile_h";

export async function getElementsByUserId(userId: string, onlyVisible = false): Promise<Element[]> {
  let query = createAdminClient()
    .from("elements")
    .select(ELEMENT_FIELDS)
    .eq("user_id", userId)
    .order("z", { ascending: true });
  if (onlyVisible) query = query.eq("visible", true);
  const { data } = await query;
  return (data ?? []) as Element[];
}
