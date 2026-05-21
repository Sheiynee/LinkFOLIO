-- ============================================================
-- STEP 14 — Phase 5 hardening
--
-- Adds the support tables the security/compliance work depends on:
--
--   * reserved_usernames  — denylist of slugs that must never be
--                           claimable (admin, api, dashboard, …).
--                           Reads are public so a client check can
--                           short-circuit; writes are admin-only.
--   * user_storage        — current bytes used per user across the
--                           four upload paths (avatars, backgrounds,
--                           fonts, element-images). Trigger-maintained
--                           so the quota check can stay one query.
--   * rate_limit_buckets  — sliding-window counters keyed by
--                           (scope, key, window_start). Used by the
--                           Postgres rate limiter in lib/rate-limit.ts.
--   * profiles.deleted_at /
--     deleted_grace_until — soft-delete columns for the 30-day grace
--                           account-deletion flow.
-- ============================================================

-- ─── Reserved usernames ────────────────────────────────────
create table if not exists public.reserved_usernames (
  username text primary key
);

insert into public.reserved_usernames (username) values
  ('admin'), ('api'), ('auth'), ('dashboard'), ('settings'),
  ('onboarding'), ('login'), ('signup'), ('signin'), ('logout'),
  ('r'), ('account'), ('billing'), ('legal'), ('terms'),
  ('privacy'), ('about'), ('help'), ('support'), ('docs'),
  ('blog'), ('press'), ('jobs'), ('careers'), ('status'),
  ('app'), ('static'), ('public'), ('assets'), ('img'), ('images'),
  ('og'), ('robots'), ('sitemap'), ('favicon'), ('manifest'),
  ('linkfolio'), ('root'), ('www'), ('mail'), ('email')
on conflict (username) do nothing;

alter table public.reserved_usernames enable row level security;

drop policy if exists "reserved_usernames public read" on public.reserved_usernames;
create policy "reserved_usernames public read"
  on public.reserved_usernames for select
  using (true);

grant select on public.reserved_usernames to anon, authenticated;
grant all privileges on public.reserved_usernames to service_role;


-- ─── User storage usage ────────────────────────────────────
create table if not exists public.user_storage (
  user_id     uuid primary key references next_auth.users(id) on delete cascade,
  bytes_used  bigint not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.user_storage enable row level security;

drop policy if exists "user_storage owner read" on public.user_storage;
create policy "user_storage owner read"
  on public.user_storage for select
  using (user_id = next_auth.uid());

grant select on public.user_storage to authenticated;
grant all privileges on public.user_storage to service_role;


-- ─── Rate limit buckets ────────────────────────────────────
create table if not exists public.rate_limit_buckets (
  scope         text   not null,
  key           text   not null,
  window_start  timestamptz not null,
  count         integer not null default 0,
  primary key (scope, key, window_start)
);

create index if not exists rate_limit_buckets_window_idx
  on public.rate_limit_buckets (window_start);

alter table public.rate_limit_buckets enable row level security;

-- No public policies — only the service role (server actions) writes.
grant all privileges on public.rate_limit_buckets to service_role;


-- ─── Soft-delete columns on profiles ──────────────────────
alter table public.profiles
  add column if not exists deleted_at timestamptz;

alter table public.profiles
  add column if not exists deleted_grace_until timestamptz;

create index if not exists profiles_deleted_grace_until_idx
  on public.profiles (deleted_grace_until)
  where deleted_grace_until is not null;
