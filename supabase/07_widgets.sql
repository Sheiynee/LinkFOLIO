-- ============================================================
-- STEP 7 — Widget blocks + provider token cache
--
-- Adds a new block type 'widget' with a 'widget_kind' column.
-- Live data (Twitch live status, YouTube stats, …) is fetched
-- server-side at request time and cached via Next.js fetch cache.
-- App-level provider tokens (Twitch app access token) are cached
-- in app_tokens so they survive across serverless invocations.
--
-- meta jsonb shapes per widget_kind:
--   twitch_live       { channel: string }            -- twitch.tv/{channel}
--   twitch_vod        { channel: string }
--   youtube_video     { video_id: string }
--   youtube_channel   { channel_id?: string, handle?: string }
--   youtube_live      { channel_id?: string, handle?: string }
--   spotify_embed     { embed_url: string }
--   tiktok_video      { video_url: string }
--   github_repo       { owner: string, repo: string }
--   github_user       { username: string }
--   discord_invite    { invite_code: string }
--   tip_jar           { platform: 'kofi'|'bmac'|'patreon'|'streamlabs', handle: string }
--   og_card           { url: string }
-- ============================================================

-- ── Extend blocks.type to include 'widget' + add widget_kind ──
alter table public.blocks
  drop constraint if exists blocks_type_check;

alter table public.blocks
  add constraint blocks_type_check
  check (type in ('link', 'text', 'heading', 'divider', 'widget'));

alter table public.blocks
  add column if not exists widget_kind text;

alter table public.blocks
  drop constraint if exists blocks_widget_kind_check;

alter table public.blocks
  add constraint blocks_widget_kind_check
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

-- A widget block must have a kind; non-widget blocks must not.
alter table public.blocks
  drop constraint if exists blocks_widget_kind_matches_type;

alter table public.blocks
  add constraint blocks_widget_kind_matches_type
  check (
    (type = 'widget' and widget_kind is not null)
    or (type <> 'widget' and widget_kind is null)
  );

create index if not exists blocks_widget_kind_idx
  on public.blocks (widget_kind)
  where widget_kind is not null;

-- ── Provider token cache (Twitch app access token, …) ────────
create table if not exists public.app_tokens (
  provider text primary key,
  access_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz default now() not null
);

alter table public.app_tokens enable row level security;
-- No public policies — only service_role accesses this table.
grant all privileges on public.app_tokens to service_role;
