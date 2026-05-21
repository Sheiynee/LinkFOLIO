-- ============================================================
-- STEP 12 — Canvas visual element types (Phase 4, part 3)
--
-- Extends the elements.type allow-list with canvas-only visual
-- primitives so creators can break out of the stacked-column look:
--
--   'shape'   -> SVG primitive (rect, circle, blob, triangle)
--   'sticker' -> a glyph from the curated icon set
--   'image'   -> a raster image uploaded by the creator with an
--                optional mask (circle / blob / polygon / rounded)
--
-- These types have no stack-mode equivalent — they exist only on
-- canvas pages. Their per-kind config lives in elements.meta:
--
--   shape:   { kind, fill, stroke?, strokeWidth?, radius?, seed? }
--   sticker: { icon, color }
--   image:   { url, storage_path?, mask?, fit?, blur? }
--
-- Image uploads reuse the existing `backgrounds` storage bucket
-- under a per-user folder, so no new bucket grant is required.
-- ============================================================

alter table public.elements
  drop constraint if exists elements_type_check;

alter table public.elements
  add constraint elements_type_check
  check (type in ('link', 'text', 'heading', 'divider', 'widget', 'shape', 'sticker', 'image'));

-- The widget_kind/type pairing rule is unchanged — non-widget rows
-- (including the three new visual types) still require widget_kind
-- to be NULL. The existing `elements_widget_kind_matches_type`
-- constraint already enforces that, but re-assert it here so this
-- migration is self-contained for fresh installs.

alter table public.elements
  drop constraint if exists elements_widget_kind_matches_type;

alter table public.elements
  add constraint elements_widget_kind_matches_type
  check (
    (type = 'widget' and widget_kind is not null)
    or (type <> 'widget' and widget_kind is null)
  );
