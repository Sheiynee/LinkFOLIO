-- ============================================================
-- STEP 9 — User-uploaded fonts
--
-- Adds a `fonts` storage bucket (woff2 only, ≤1MB per file) and
-- a public.user_fonts table that maps uploaded files to a family
-- name + weight/style for use as theme.typography.*.family with
-- source = 'user_font'.
--
-- Per-user storage cap is enforced in application code by reading
-- the sum of size_bytes for the user before allowing a new upload.
-- ============================================================

create table if not exists public.user_fonts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references next_auth.users(id) on delete cascade,
  family_name  text not null check (char_length(family_name) between 1 and 80),
  weight       integer check (weight is null or (weight between 100 and 900)),
  style        text check (style is null or style in ('normal', 'italic', 'oblique')),
  url          text not null,
  storage_path text not null,
  size_bytes   bigint not null check (size_bytes >= 0 and size_bytes <= 1048576),
  created_at   timestamptz not null default now()
);

create index if not exists user_fonts_user_id_idx on public.user_fonts (user_id);

alter table public.user_fonts enable row level security;

-- Public read: any user_font referenced by a public profile must be readable.
-- The `family_name`/`url` are not secret (font files are served publicly via
-- the storage bucket anyway). Restrict insert/update/delete to owners.
create policy "User fonts are publicly readable"
  on public.user_fonts for select
  using (true);

create policy "Users can insert their own fonts"
  on public.user_fonts for insert
  with check (user_id = next_auth.uid());

create policy "Users can update their own fonts"
  on public.user_fonts for update
  using (user_id = next_auth.uid());

create policy "Users can delete their own fonts"
  on public.user_fonts for delete
  using (user_id = next_auth.uid());

grant all privileges on public.user_fonts to service_role;
grant select on public.user_fonts to authenticated, anon;

-- Storage bucket for the font files themselves.
insert into storage.buckets (id, name, public)
values ('fonts', 'fonts', true)
on conflict do nothing;

create policy "Fonts are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'fonts');

create policy "Users can upload their own fonts"
  on storage.objects for insert
  with check (
    bucket_id = 'fonts'
    and (storage.foldername(name))[1] = next_auth.uid()::text
  );

create policy "Users can delete their own fonts"
  on storage.objects for delete
  using (
    bucket_id = 'fonts'
    and (storage.foldername(name))[1] = next_auth.uid()::text
  );
