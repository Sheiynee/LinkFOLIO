-- ============================================================
-- STEP 4 — Theme customization
-- Converts profiles.theme to jsonb, adds backgrounds bucket
-- ============================================================

-- Convert theme column to jsonb (preserve existing string values as preset)
alter table public.profiles
  alter column theme drop default;

alter table public.profiles
  alter column theme type jsonb using
    case
      when theme is null then '{"preset":"glass"}'::jsonb
      when theme ~ '^\{' then theme::jsonb
      else jsonb_build_object('preset', theme)
    end;

alter table public.profiles
  alter column theme set default '{"preset":"glass"}'::jsonb;

-- Backgrounds storage bucket for custom page backgrounds
insert into storage.buckets (id, name, public)
values ('backgrounds', 'backgrounds', true)
on conflict do nothing;

create policy "Background images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'backgrounds');

create policy "Users can upload their own backgrounds"
  on storage.objects for insert
  with check (
    bucket_id = 'backgrounds'
    and (storage.foldername(name))[1] = next_auth.uid()::text
  );

create policy "Users can update their own backgrounds"
  on storage.objects for update
  using (
    bucket_id = 'backgrounds'
    and (storage.foldername(name))[1] = next_auth.uid()::text
  );

create policy "Users can delete their own backgrounds"
  on storage.objects for delete
  using (
    bucket_id = 'backgrounds'
    and (storage.foldername(name))[1] = next_auth.uid()::text
  );
