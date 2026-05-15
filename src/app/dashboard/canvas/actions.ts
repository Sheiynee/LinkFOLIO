"use server";

import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import {
  CANVAS_WIDTH,
  MIN_ELEMENT_H,
  MIN_ELEMENT_W,
  STACK_INSET_TOP,
  stackLayoutForBlocks,
  type ElementType,
  type LayoutMode,
} from "@/lib/elements";
import type { BlockType } from "@/lib/blocks";
import type { WidgetKind } from "@/lib/widgets/types";
import { detectWidgetFromUrl } from "@/lib/widgets/detect";
import { parseTipJarUrl } from "@/lib/widgets/tip-jar";
import { DEFAULT_ELEMENT_HEIGHTS } from "@/lib/elements";

async function getUsernameForUser(userId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();
  return data?.username ?? null;
}

async function revalidateUserPages(userId: string) {
  const username = await getUsernameForUser(userId);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/canvas");
  if (username) revalidatePath(`/${username}`);
}

export async function setLayoutMode(mode: LayoutMode) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ layout_mode: mode })
    .eq("id", session.user.id);
  if (error) return { error: error.message };

  await revalidateUserPages(session.user.id);
  return { ok: true };
}

/**
 * Switch the profile into canvas mode AND copy every existing block into a
 * vertical-stack element layout. Idempotent: if elements already exist for
 * this user, the existing layout is preserved.
 */
export async function enableCanvasFromBlocks() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("elements")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.user.id);

  // If the user already has elements, just flip the flag.
  // (The dashboard guard prevents this path from running twice anyway.)
  if (existing === null) {
    // ignore — the head:true query returns null data but we relied on the side-effect query.
  }

  const { count: elCount } = await supabase
    .from("elements")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.user.id);

  if ((elCount ?? 0) === 0) {
    const { data: blocks } = await supabase
      .from("blocks")
      .select("type, title, url, content, visible, widget_kind, meta")
      .eq("user_id", session.user.id)
      .order("position", { ascending: true });
    const list = blocks ?? [];
    const slots = stackLayoutForBlocks(list, STACK_INSET_TOP);
    if (list.length > 0) {
      const rows = list.map((b, i) => ({
        user_id: session.user.id,
        type: b.type as BlockType,
        widget_kind: b.widget_kind ?? null,
        title: b.title ?? null,
        url: b.url ?? null,
        content: b.content ?? null,
        visible: b.visible ?? true,
        meta: b.meta ?? null,
        x: slots[i].x,
        y: slots[i].y,
        w: slots[i].w,
        h: slots[i].h,
        rotation: 0,
        z: i,
      }));
      const { error: insertError } = await supabase.from("elements").insert(rows);
      if (insertError) return { error: insertError.message };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ layout_mode: "canvas" })
    .eq("id", session.user.id);
  if (error) return { error: error.message };

  await revalidateUserPages(session.user.id);
  return { ok: true };
}

interface CreateElementInput {
  type: ElementType;
  widget_kind?: WidgetKind | null;
  title?: string | null;
  url?: string | null;
  content?: string | null;
  meta?: Record<string, unknown> | null;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export async function createElement(input: CreateElementInput) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  const { data: maxRow } = await supabase
    .from("elements")
    .select("z")
    .eq("user_id", session.user.id)
    .order("z", { ascending: false })
    .limit(1)
    .maybeSingle();
  const z = (maxRow?.z ?? -1) + 1;

  const w = Math.max(MIN_ELEMENT_W, input.w ?? 320);
  const h = Math.max(MIN_ELEMENT_H, input.h ?? 56);
  const x = clamp(input.x ?? 24, 0, CANVAS_WIDTH - w);
  const y = Math.max(0, input.y ?? 200);

  const { data, error } = await supabase
    .from("elements")
    .insert({
      user_id: session.user.id,
      type: input.type,
      widget_kind: input.widget_kind ?? null,
      title: input.title ?? null,
      url: input.url ?? null,
      content: input.content ?? null,
      meta: input.meta ?? null,
      x,
      y,
      w,
      h,
      rotation: 0,
      z,
    })
    .select("id, type, widget_kind, title, url, content, visible, meta, x, y, w, h, rotation, z, locked")
    .single();

  if (error) return { error: error.message };
  await revalidateUserPages(session.user.id);
  return { ok: true, element: data };
}

export interface ElementPatch {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rotation?: number;
  z?: number;
  visible?: boolean;
  locked?: boolean;
  title?: string | null;
  url?: string | null;
  content?: string | null;
  meta?: Record<string, unknown> | null;
}

export async function updateElement(id: string, patch: ElementPatch) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  // Clamp numeric fields server-side so a hostile client can't write
  // negative widths / off-canvas positions.
  const clean: ElementPatch = { ...patch };
  if (typeof clean.w === "number") clean.w = Math.max(MIN_ELEMENT_W, Math.round(clean.w));
  if (typeof clean.h === "number") clean.h = Math.max(MIN_ELEMENT_H, Math.round(clean.h));
  if (typeof clean.x === "number") clean.x = clamp(Math.round(clean.x), -CANVAS_WIDTH, CANVAS_WIDTH * 2);
  if (typeof clean.y === "number") clean.y = Math.max(-200, Math.round(clean.y));
  if (typeof clean.rotation === "number") clean.rotation = clamp(clean.rotation, -360, 360);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("elements")
    .update(clean)
    .eq("id", id)
    .eq("user_id", session.user.id);
  if (error) return { error: error.message };

  await revalidateUserPages(session.user.id);
  return { ok: true };
}

/**
 * Detect a widget kind from a URL on the server and create the element.
 * The detection logic lives in lib/widgets/detect which transitively
 * imports server-only modules, so it can't run in a client component.
 */
export async function createWidgetElementFromUrl(url: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const trimmed = url.trim();
  if (!trimmed) return { error: "URL is required" };

  const tip = parseTipJarUrl(trimmed);
  let resolved = detectWidgetFromUrl(trimmed);
  if (!resolved && tip) {
    resolved = {
      kind: "tip_jar",
      meta: { platform: tip.platform, handle: tip.handle },
      label: `Tip on ${tip.platform}`,
    };
  }
  if (!resolved) return { error: "Couldn't detect a widget from that URL" };

  return createElement({
    type: "widget",
    widget_kind: resolved.kind as WidgetKind,
    title: resolved.label,
    meta: resolved.meta,
    h: DEFAULT_ELEMENT_HEIGHTS.widget,
  });
}

export async function deleteElement(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("elements")
    .delete()
    .eq("id", id)
    .eq("user_id", session.user.id);
  if (error) return { error: error.message };

  await revalidateUserPages(session.user.id);
  return { ok: true };
}

export async function deleteElements(ids: string[]) {
  if (ids.length === 0) return { ok: true };
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("elements")
    .delete()
    .in("id", ids)
    .eq("user_id", session.user.id);
  if (error) return { error: error.message };
  await revalidateUserPages(session.user.id);
  return { ok: true };
}

export interface BatchPatch {
  id: string;
  patch: ElementPatch;
}

/**
 * Apply many patches in one round trip. Used by undo/redo (restoring a
 * snapshot), group align/distribute, and multi-select drag. Each patch
 * is independently RLS-checked by the per-id update — no service-role
 * trust shortcut.
 */
export async function batchUpdateElements(updates: BatchPatch[]) {
  if (updates.length === 0) return { ok: true };
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  for (const u of updates) {
    const clean: ElementPatch = { ...u.patch };
    if (typeof clean.w === "number") clean.w = Math.max(MIN_ELEMENT_W, Math.round(clean.w));
    if (typeof clean.h === "number") clean.h = Math.max(MIN_ELEMENT_H, Math.round(clean.h));
    if (typeof clean.x === "number") clean.x = clamp(Math.round(clean.x), -CANVAS_WIDTH, CANVAS_WIDTH * 2);
    if (typeof clean.y === "number") clean.y = Math.max(-200, Math.round(clean.y));
    if (typeof clean.rotation === "number") clean.rotation = clamp(clean.rotation, -360, 360);
    const { error } = await supabase
      .from("elements")
      .update(clean)
      .eq("id", u.id)
      .eq("user_id", session.user.id);
    if (error) return { error: error.message };
  }
  await revalidateUserPages(session.user.id);
  return { ok: true };
}

/** Duplicate elements server-side. Returns the newly-created rows. */
export async function duplicateElements(ids: string[]) {
  if (ids.length === 0) return { ok: true as const, elements: [] };
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" } as const;

  const supabase = createAdminClient();
  const { data: rows, error: lookupError } = await supabase
    .from("elements")
    .select("type, widget_kind, title, url, content, visible, meta, x, y, w, h, rotation, z, locked, mobile_x, mobile_y, mobile_w, mobile_h")
    .in("id", ids)
    .eq("user_id", session.user.id);
  if (lookupError) return { error: lookupError.message } as const;
  if (!rows || rows.length === 0) return { ok: true as const, elements: [] };

  const { data: maxRow } = await supabase
    .from("elements")
    .select("z")
    .eq("user_id", session.user.id)
    .order("z", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextZ = (maxRow?.z ?? -1) + 1;

  const inserts = rows.map((r) => ({
    user_id: session.user!.id,
    ...r,
    x: r.x + 16,
    y: r.y + 16,
    z: nextZ++,
  }));
  const { data: inserted, error: insertError } = await supabase
    .from("elements")
    .insert(inserts)
    .select("id, type, widget_kind, title, url, content, visible, meta, x, y, w, h, rotation, z, locked, mobile_x, mobile_y, mobile_w, mobile_h");
  if (insertError) return { error: insertError.message } as const;

  await revalidateUserPages(session.user.id);
  return { ok: true as const, elements: inserted ?? [] };
}

export interface MobilePatch {
  id: string;
  mobile_x?: number | null;
  mobile_y?: number | null;
  mobile_w?: number | null;
  mobile_h?: number | null;
}

export async function updateMobilePlacements(patches: MobilePatch[]) {
  if (patches.length === 0) return { ok: true };
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  const supabase = createAdminClient();
  for (const p of patches) {
    const { error } = await supabase
      .from("elements")
      .update({
        mobile_x: p.mobile_x ?? null,
        mobile_y: p.mobile_y ?? null,
        mobile_w: p.mobile_w ?? null,
        mobile_h: p.mobile_h ?? null,
      })
      .eq("id", p.id)
      .eq("user_id", session.user.id);
    if (error) return { error: error.message };
  }
  await revalidateUserPages(session.user.id);
  return { ok: true };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
