-- Migration 17: account management
-- Adds email change tokens, email digest preference, and cross-schema RPC helpers.

-- Email change tokens (short-lived, single-use)
create table if not exists public.email_change_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references next_auth.users(id) on delete cascade,
  new_email  text not null,
  token      text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz default now() not null
);

alter table public.email_change_tokens enable row level security;
-- Only service_role accesses this table; no user-facing RLS policies needed.

create index if not exists email_change_tokens_token_idx
  on public.email_change_tokens (token)
  where used_at is null;

create index if not exists email_change_tokens_user_idx
  on public.email_change_tokens (user_id);

-- Weekly stats digest opt-in on profiles
alter table public.profiles
  add column if not exists email_digest_opted_in boolean not null default false;

-- RPC helpers for cross-schema operations (next_auth schema → public PostgREST).
-- These run as SECURITY DEFINER so the service_role client can call them as RPCs.

create or replace function public.get_user_linked_providers(p_user_id uuid)
returns text[]
language sql
security definer
set search_path = next_auth, public
stable
as $$
  select coalesce(array_agg(provider order by provider), '{}')
  from next_auth.accounts
  where "userId" = p_user_id;
$$;

create or replace function public.email_exists(p_email text)
returns boolean
language sql
security definer
set search_path = next_auth, public
stable
as $$
  select exists(select 1 from next_auth.users where lower(email) = lower(p_email));
$$;

create or replace function public.update_user_email(p_user_id uuid, p_new_email text)
returns void
language sql
security definer
set search_path = next_auth, public
as $$
  update next_auth.users set email = p_new_email where id = p_user_id;
$$;

create or replace function public.get_user_email(p_user_id uuid)
returns text
language sql
security definer
set search_path = next_auth, public
stable
as $$
  select email from next_auth.users where id = p_user_id limit 1;
$$;
