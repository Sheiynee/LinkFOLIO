import { revalidatePath } from "next/cache";
import { createAdminClient } from "./supabase/admin";

/**
 * Looks up the user's public-facing username and invalidates the route so
 * visitors see fresh content. Call this after any mutation that changes what
 * appears on the public profile page.
 */
export async function revalidatePublicPage(userId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();
  if (data?.username) revalidatePath(`/${data.username}`);
}
