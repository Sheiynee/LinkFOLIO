"use server";

import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import {
  CANVAS_WIDTH,
  MIN_ELEMENT_H,
  MIN_ELEMENT_W,
  STACK_GAP_Y,
  STACK_INSET_TOP,
  stackLayoutForBlocks,
  type ElementType,
  type LayoutMode,
} from "@/lib/elements";
import type { BlockType } from "@/lib/blocks";
import type { WidgetKind } from "@/lib/widgets/types";
import { detectWidgetFromUrl } from "@/lib/widgets/detect";
import { parseTipJarUrl } from "@/lib/widgets/tip-jar";
import { resolveWidget } from "@/lib/widgets/resolve";
import { DEFAULT_ELEMENT_HEIGHTS, DEFAULT_VISUAL_ELEMENT_SIZE } from "@/lib/elements";
import {
  defaultImageMeta,
  defaultRegionMeta,
  defaultShapeMeta,
  defaultStickerMeta,
  type ShapeKind,
  type StickerIcon,
} from "@/lib/visual-elements";
import { validateImageFile } from "@/lib/image-magic";
import { addStorageUsage, ensureStorageHeadroom } from "@/lib/storage-quota";
import { rateLimit, RL_UPLOAD } from "@/lib/rate-limit";
import { validateLinkUrl } from "@/lib/url-validate";
import { sanitizeMultilineText, sanitizeShortText } from "@/lib/sanitize";
import { ensureChannelSubscriptions } from "@/lib/twitch-eventsub";
import { revalidatePublicPage } from "@/lib/revalidate";

async function revalidateUserPages(userId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/canvas");
  await revalidatePublicPage(userId);
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

  // Validate user-supplied URLs server-side; the client can be bypassed.
  let cleanUrl = input.url ?? null;
  if (input.type === "link" && cleanUrl) {
    const v = validateLinkUrl(cleanUrl);
    if (!v.ok) return { error: v.reason };
    cleanUrl = v.url;
  }

  // Sanitize text fields so a hostile client can't smuggle control chars
  // or fullwidth lookalikes into stored content.
  const cleanTitle = input.title ? sanitizeShortText(input.title) : null;
  const cleanContent = input.content ? sanitizeMultilineText(input.content) : null;

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("elements")
    .select("z, y, h")
    .eq("user_id", session.user.id);
  const rows = existing ?? [];
  const z = rows.reduce((acc, r) => Math.max(acc, r.z ?? -1), -1) + 1;
  // Default y lands below every existing element, never inside the header.
  const lowestBottom = rows.reduce((acc, r) => Math.max(acc, (r.y ?? 0) + (r.h ?? 0)), STACK_INSET_TOP - STACK_GAP_Y);

  const w = Math.max(MIN_ELEMENT_W, input.w ?? 320);
  const h = Math.max(MIN_ELEMENT_H, input.h ?? 56);
  const x = clamp(input.x ?? 24, 0, CANVAS_WIDTH - w);
  const y = Math.max(STACK_INSET_TOP, input.y ?? lowestBottom + STACK_GAP_Y);

  const { data, error } = await supabase
    .from("elements")
    .insert({
      user_id: session.user.id,
      type: input.type,
      widget_kind: input.widget_kind ?? null,
      title: cleanTitle,
      url: cleanUrl,
      content: cleanContent,
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

  // Fire-and-forget EventSub subscription for Twitch live elements.
  if (input.widget_kind === "twitch_live" && typeof input.meta?.channel === "string") {
    void ensureChannelSubscriptions(input.meta.channel);
  }

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

export interface SaveOptions {
  /**
   * Skip cache revalidation for this write. Used by continuous gestures
   * (drag/resize/rotate) which save every 250ms — the gesture's pointerup
   * flush performs a final save WITH revalidation.
   */
  skipRevalidate?: boolean;
}

export async function updateElement(id: string, patch: ElementPatch, opts?: SaveOptions) {
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
  if (typeof clean.url === "string" && clean.url.length > 0) {
    const v = validateLinkUrl(clean.url);
    if (!v.ok) return { error: v.reason };
    clean.url = v.url;
  }
  if (typeof clean.title === "string") clean.title = sanitizeShortText(clean.title);
  if (typeof clean.content === "string") clean.content = sanitizeMultilineText(clean.content);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("elements")
    .update(clean)
    .eq("id", id)
    .eq("user_id", session.user.id);
  if (error) return { error: error.message };

  if (!opts?.skipRevalidate) await revalidateUserPages(session.user.id);
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

/**
 * Create a widget element from a specific kind + input (channel name, URL,
 * handle, etc.) — used by the canvas-mode picker for users who want a
 * named widget rather than relying on URL auto-detection.
 */
export async function createWidgetElementByKind(kind: WidgetKind, input: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const resolved = resolveWidget(kind, input);
  if ("error" in resolved) return { error: resolved.error };

  return createElement({
    type: "widget",
    widget_kind: resolved.kind as WidgetKind,
    title: resolved.title,
    meta: resolved.meta,
    h: DEFAULT_ELEMENT_HEIGHTS.widget,
  });
}

/**
 * Re-source an existing widget element with a new input. Same shape as
 * `updateWidgetBlock` for stack mode.
 */
export async function updateWidgetElement({ id, input }: { id: string; input: string }) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("elements")
    .select("id, widget_kind")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single();
  if (!existing || !existing.widget_kind) return { error: "Not found" };

  const resolved = resolveWidget(existing.widget_kind as WidgetKind, input);
  if ("error" in resolved) return { error: resolved.error };

  const { error } = await supabase
    .from("elements")
    .update({ meta: resolved.meta, title: resolved.title })
    .eq("id", id)
    .eq("user_id", session.user.id);
  if (error) return { error: error.message };

  await revalidateUserPages(session.user.id);
  return { ok: true, meta: resolved.meta, title: resolved.title };
}

/** Create a region element pre-filled with a soft gradient. */
export async function createRegionElement() {
  const size = DEFAULT_VISUAL_ELEMENT_SIZE.region;
  return createElement({
    type: "region",
    meta: defaultRegionMeta() as unknown as Record<string, unknown>,
    w: size.w,
    h: size.h,
  });
}

/** Create a shape element with sensible defaults for its kind. */
export async function createShapeElement(kind: ShapeKind) {
  const size = DEFAULT_VISUAL_ELEMENT_SIZE.shape;
  return createElement({
    type: "shape",
    meta: defaultShapeMeta(kind) as unknown as Record<string, unknown>,
    w: size.w,
    h: size.h,
  });
}

/** Create a sticker element. */
export async function createStickerElement(icon: StickerIcon) {
  const size = DEFAULT_VISUAL_ELEMENT_SIZE.sticker;
  return createElement({
    type: "sticker",
    meta: defaultStickerMeta(icon) as unknown as Record<string, unknown>,
    w: size.w,
    h: size.h,
  });
}

const MAX_ELEMENT_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Upload a creator-supplied image and create an `image` element pointing at it.
 * Magic-byte validation runs before the upload, so a renamed `.png` containing
 * an executable can't sneak through. The file lands in the existing
 * `backgrounds` bucket under `${userId}/element-images/` — same access rules,
 * same RLS — to avoid spinning up another bucket grant.
 */
export async function uploadAndCreateImageElement(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const rl = await rateLimit(session.user.id, RL_UPLOAD);
  if (!rl.allowed) return { error: `Too many uploads. Try again in ${rl.retryAfterSeconds}s.` };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file selected" };
  if (file.size > MAX_ELEMENT_IMAGE_BYTES) return { error: "Image must be under 5MB" };

  const quota = await ensureStorageHeadroom(session.user.id, file.size);
  if (!quota.ok) return { error: quota.reason };

  const validated = await validateImageFile(file);
  if (!validated.ok) return { error: validated.reason };

  const supabase = createAdminClient();
  const path = `${session.user.id}/element-images/${Date.now()}.${validated.ext}`;
  const { error: uploadError } = await supabase.storage
    .from("backgrounds")
    .upload(path, file, { upsert: true, contentType: file.type || `image/${validated.ext}` });
  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage.from("backgrounds").getPublicUrl(path);
  await addStorageUsage(session.user.id, file.size);
  const size = DEFAULT_VISUAL_ELEMENT_SIZE.image;
  return createElement({
    type: "image",
    meta: defaultImageMeta(publicUrl, path) as unknown as Record<string, unknown>,
    w: size.w,
    h: size.h,
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
  const results = await Promise.all(
    updates.map(async (u) => {
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
      return error;
    })
  );
  const firstError = results.find((e) => e != null);
  if (firstError) return { error: firstError.message };
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

export async function updateMobilePlacements(patches: MobilePatch[], opts?: SaveOptions) {
  if (patches.length === 0) return { ok: true };
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  const supabase = createAdminClient();
  const results = await Promise.all(
    patches.map(async (p) => {
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
      return error;
    })
  );
  const firstError = results.find((e) => e != null);
  if (firstError) return { error: firstError.message };
  if (!opts?.skipRevalidate) await revalidateUserPages(session.user.id);
  return { ok: true };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
