-- ============================================================
-- STEP 1 — Run this first in the Supabase SQL editor
-- Sets up the next_auth schema required by @auth/supabase-adapter
-- ============================================================

-- Create the schema
create schema if not exists next_auth;

-- Grant service_role full access (the adapter uses your service role key)
grant usage on schema next_auth to service_role;
grant all privileges on all tables in schema next_auth to service_role;
grant all privileges on all sequences in schema next_auth to service_role;
grant all privileges on all routines in schema next_auth to service_role;

-- Users table
create table if not exists next_auth.users (
  id uuid not null default gen_random_uuid(),
  name text,
  email text unique,
  "emailVerified" timestamptz,
  image text,
  primary key (id)
);

-- OAuth accounts (GitHub, Google tokens live here)
create table if not exists next_auth.accounts (
  id uuid not null default gen_random_uuid(),
  "userId" uuid not null references next_auth.users(id) on delete cascade,
  type text not null,
  provider text not null,
  "providerAccountId" text not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  primary key (id),
  unique (provider, "providerAccountId")
);

-- Sessions
create table if not exists next_auth.sessions (
  id uuid not null default gen_random_uuid(),
  "sessionToken" text not null unique,
  "userId" uuid not null references next_auth.users(id) on delete cascade,
  expires timestamptz not null,
  primary key (id)
);

-- Email magic link / verification tokens
create table if not exists next_auth.verification_tokens (
  identifier text not null,
  token text not null,
  expires timestamptz not null,
  primary key (identifier, token)
);

-- Helper function so RLS policies can call next_auth.uid()
-- It reads the sub claim from the JWT NextAuth issues
create or replace function next_auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
