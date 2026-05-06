-- ============================================================
-- STEP 2 — Run this after 01_nextauth_schema.sql
-- Creates your app tables in the public schema
-- ============================================================

-- Profiles (one per user, keyed to next_auth.users)
create table if not exists public.profiles (
  id uuid primary key references next_auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  bio text,
  avatar_url text,
  theme text default 'purple',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Links (many per user)
create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references next_auth.users(id) on delete cascade not null,
  title text not null,
  url text not null,
  icon text,
  position integer default 0,
  created_at timestamptz default now()
);

-- Page view analytics
create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  viewed_at timestamptz default now(),
  referrer text
);

-- ── Row Level Security ──────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.links enable row level security;
alter table public.page_views enable row level security;

-- Profiles: anyone reads, owner writes
-- RLS uses next_auth.uid() which reads the JWT sub NextAuth signs
create policy "Profiles are publicly readable"
  on public.profiles for select using (true);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (next_auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (next_auth.uid() = id);

-- Links: anyone reads, owner manages
create policy "Links are publicly readable"
  on public.links for select using (true);

create policy "Users can manage own links"
  on public.links for all
  using (next_auth.uid() = user_id);

-- ── Storage bucket for avatars ──────────────────────────────

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict do nothing;

create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = next_auth.uid()::text
  );

-- ── Auto-create profile on first sign-in ───────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_username text;
  final_username text;
  counter int := 0;
begin
  -- Derive a username from email (part before @), strip non-alphanumeric
  base_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9]', '', 'g'));
  final_username := base_username;

  -- Append number if username already taken
  while exists (select 1 from public.profiles where username = final_username) loop
    counter := counter + 1;
    final_username := base_username || counter::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (new.id, final_username, new.name, new.image);

  return new;
end;
$$;

create or replace trigger on_nextauth_user_created
  after insert on next_auth.users
  for each row execute procedure public.handle_new_user();
