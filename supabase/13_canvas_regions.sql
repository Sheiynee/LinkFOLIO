-- ============================================================
-- STEP 13 — Canvas region element (Phase 4, part 3)
--
-- Adds the 'region' element type so creators can paint a section
-- of the canvas with its own background layer stack (gradient,
-- mesh, pattern, image). Regions render behind sibling elements
-- at their declared z-index, scoped to the region's bounding box.
--
-- The region's per-instance config (its background layers) lives
-- in elements.meta as:
--
--   region: { layers: BgLayer[], radius?: number }
--
-- where BgLayer is the same union used by `profiles.theme.background`.
-- ============================================================

alter table public.elements
  drop constraint if exists elements_type_check;

alter table public.elements
  add constraint elements_type_check
  check (type in ('link', 'text', 'heading', 'divider', 'widget', 'shape', 'sticker', 'image', 'region'));

alter table public.elements
  drop constraint if exists elements_widget_kind_matches_type;

alter table public.elements
  add constraint elements_widget_kind_matches_type
  check (
    (type = 'widget' and widget_kind is not null)
    or (type <> 'widget' and widget_kind is null)
  );
