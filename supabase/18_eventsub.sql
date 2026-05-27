-- Migration 18: Twitch EventSub infrastructure
-- creator_live_status — written by webhook, read by widgets + OG images.
-- twitch_eventsub_subscriptions — subscription registry for idempotency.

create table if not exists public.creator_live_status (
  channel        text primary key,           -- Twitch login (lowercase)
  broadcaster_id text not null,
  is_live        boolean not null default false,
  stream_title   text,
  game_name      text,
  viewer_count   integer,
  started_at     timestamptz,
  updated_at     timestamptz default now() not null
);

-- Public read so the public page SSR can use anon client if needed.
-- Writes are service_role only (no user-facing RLS).
alter table public.creator_live_status enable row level security;

create policy "public read creator_live_status"
  on public.creator_live_status for select
  using (true);

create table if not exists public.twitch_eventsub_subscriptions (
  id             text primary key,           -- Twitch's subscription UUID
  broadcaster_id text not null,
  channel        text not null,
  event_type     text not null,              -- 'stream.online' | 'stream.offline'
  status         text not null default 'pending',
  created_at     timestamptz default now() not null
);

alter table public.twitch_eventsub_subscriptions enable row level security;
-- Only service_role accesses this table.

create index if not exists eventsub_subs_broadcaster_idx
  on public.twitch_eventsub_subscriptions (broadcaster_id);
