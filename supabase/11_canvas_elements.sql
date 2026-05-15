-- ============================================================
-- STEP 11 — Canvas elements (Phase 4a, part 1)
--
-- Introduces a positioned-element model that coexists with the
-- existing `blocks` (stacked column) model. A profile selects one
-- of the two via `profiles.layout_mode`:
--
--   'stack'  -> render blocks (existing behavior, default)
--   'canvas' -> render elements (new)
--
-- Opt-in is one-way for now: when a user picks canvas, the app
-- copies their blocks into elements with a vertical-stack layout
-- so the page looks identical before they start arranging.
--
-- Mobile overrides ship with Phase 4b. For now only the desktop
-- (`x,y,w,h`) columns are written by the editor.
-- ============================================================

alter table public.profiles
  add column if not exists layout_mode text not null default 'stack';

alter table public.profiles
  drop constraint if exists profiles_layout_mode_check;

alter table public.profiles
  add constraint profiles_layout_mode_check
  check (layout_mode in ('stack', 'canvas'));

create table if not exists public.elements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references next_auth.users(id) on delete cascade,
  type        text not null,
  -- Widget-only — non-widget elements set NULL.
  widget_kind text,
  -- Block-shaped content (mirrors blocks.title/url/content).
  title       text,
  url         text,
  content     text,
  visible     boolean not null default true,
  meta        jsonb,
  -- Desktop placement (canvas px). Origin is the top-left of the page area.
  x           integer not null default 0,
  y           integer not null default 0,
  w           integer not null default 320,
  h           integer not null default 56,
  rotation    real    not null default 0,
  z           integer not null default 0,
  locked      boolean not null default false,
  -- Mobile placement overrides — null means "use auto-reflow" (Phase 4b).
  mobile_x    integer,
  mobile_y    integer,
  mobile_w    integer,
  mobile_h    integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists elements_user_id_idx on public.elements (user_id);
create index if not exists elements_user_z_idx on public.elements (user_id, z);

alter table public.elements
  drop constraint if exists elements_type_check;

alter table public.elements
  add constraint elements_type_check
  check (type in ('link', 'text', 'heading', 'divider', 'widget'));

alter table public.elements
  drop constraint if exists elements_widget_kind_matches_type;

alter table public.elements
  add constraint elements_widget_kind_matches_type
  check (
    (type = 'widget' and widget_kind is not null)
    or (type <> 'widget' and widget_kind is null)
  );

-- Reuse the same widget_kind allow-list as blocks.
alter table public.elements
  drop constraint if exists elements_widget_kind_check;

alter table public.elements
  add constraint elements_widget_kind_check
  check (
    widget_kind is null or widget_kind in (
      'twitch_live', 'twitch_vod',
      'youtube_video', 'youtube_channel', 'youtube_live',
      'spotify_embed', 'tiktok_video',
      'github_repo', 'github_user',
      'discord_invite',
      'tip_jar',
      'og_card'
    )
  );

-- updated_at trigger.
create or replace function public._touch_elements_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_elements_updated_at on public.elements;
create trigger touch_elements_updated_at
  before update on public.elements
  for each row execute function public._touch_elements_updated_at();

alter table public.elements enable row level security;

create policy "Elements are publicly readable when visible"
  on public.elements for select
  using (visible = true);

create policy "Users can read their own elements"
  on public.elements for select
  using (user_id = next_auth.uid());

create policy "Users can insert their own elements"
  on public.elements for insert
  with check (user_id = next_auth.uid());

create policy "Users can update their own elements"
  on public.elements for update
  using (user_id = next_auth.uid());

create policy "Users can delete their own elements"
  on public.elements for delete
  using (user_id = next_auth.uid());

grant all privileges on public.elements to service_role;
grant select on public.elements to anon, authenticated;
