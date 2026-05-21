-- ============================================================
-- STEP 16 — Materialized views for analytics
--
-- The dashboard stat cards currently sum `page_views` and `block_clicks`
-- on every request. That's fine at our scale today, but as soon as a
-- creator's page gets thousands of views the page-load query for their
-- dashboard would do a full table scan.
--
-- These materialized views collapse the click + view streams into daily
-- aggregates. Refresh every 5 minutes via pg_cron (cron schedule is
-- created below; you need to enable pg_cron on the project for it to fire,
-- which is a one-click toggle in the Supabase dashboard).
-- ============================================================

create materialized view if not exists public.mv_page_views_daily as
select
  profile_id,
  date_trunc('day', viewed_at) as day,
  count(*) as views
from public.page_views
group by profile_id, date_trunc('day', viewed_at);

create unique index if not exists mv_page_views_daily_pk
  on public.mv_page_views_daily (profile_id, day);

create materialized view if not exists public.mv_block_clicks_daily as
select
  block_id,
  date_trunc('day', clicked_at) as day,
  count(*) as clicks
from public.block_clicks
group by block_id, date_trunc('day', clicked_at);

create unique index if not exists mv_block_clicks_daily_pk
  on public.mv_block_clicks_daily (block_id, day);

grant select on public.mv_page_views_daily to authenticated, service_role;
grant select on public.mv_block_clicks_daily to authenticated, service_role;

-- Refresh function — called by pg_cron and also re-usable by the export
-- action if a creator wants fresh totals on demand.
create or replace function public.refresh_analytics_matviews()
returns void
language plpgsql
security definer
as $$
begin
  refresh materialized view concurrently public.mv_page_views_daily;
  refresh materialized view concurrently public.mv_block_clicks_daily;
end;
$$;

grant execute on function public.refresh_analytics_matviews() to service_role;

-- Schedule a 5-minute refresh. Safe to run repeatedly; only one of the
-- statements actually fires if pg_cron is already configured.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'linkfolio-refresh-analytics',
      '*/5 * * * *',
      $cron$ select public.refresh_analytics_matviews(); $cron$
    );
  end if;
end $$;
