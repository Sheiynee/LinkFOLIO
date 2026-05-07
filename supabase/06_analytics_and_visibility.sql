-- ============================================================
-- STEP 6 — Analytics + block visibility
-- Adds click tracking, hidden blocks, grants for page_views.
-- ============================================================

-- ── Block visibility ──────────────────────────────────────
alter table public.blocks
  add column if not exists visible boolean default true not null;

-- ── Click tracking ────────────────────────────────────────
create table if not exists public.block_clicks (
  id uuid primary key default gen_random_uuid(),
  block_id uuid references public.blocks(id) on delete cascade not null,
  clicked_at timestamptz default now() not null,
  referrer text,
  country text
);

create index if not exists block_clicks_block_idx
  on public.block_clicks (block_id, clicked_at desc);

create index if not exists page_views_profile_idx
  on public.page_views (profile_id, viewed_at desc);

-- ── RLS ────────────────────────────────────────────────────
alter table public.block_clicks enable row level security;

create policy "Users can read clicks on their own blocks"
  on public.block_clicks for select
  using (
    block_id in (
      select id from public.blocks where user_id = next_auth.uid()
    )
  );

-- Page views: owners can read their own
drop policy if exists "Users can read own page views" on public.page_views;
create policy "Users can read own page views"
  on public.page_views for select
  using (profile_id = next_auth.uid());

-- ── Grants ────────────────────────────────────────────────
grant all privileges on public.block_clicks to service_role;
grant all privileges on public.page_views to service_role;
