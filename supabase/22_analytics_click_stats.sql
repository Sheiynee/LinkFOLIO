-- ============================================================
-- STEP 22 — Aggregate click stats in Postgres
--
-- The analytics dashboard previously selected raw `block_clicks` rows and
-- aggregated referrers/countries/totals in JS. Supabase caps responses at
-- 1000 rows, so any creator with >1000 clicks in the selected window got
-- silently undercounted totals and breakdowns.
--
-- This RPC pushes the aggregation into Postgres and returns exactly the
-- top-8 referrer domains, top-8 countries, and the true total — one round
-- trip, no row caps. Domain extraction mirrors the old JS rules:
--   * null or unparseable referrer  → 'Direct'
--   * hostname lowercased, leading 'www.' stripped
-- ============================================================

create or replace function public.get_click_stats(
  p_user_id uuid,
  p_cutoff timestamptz default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with owned as (
    select c.referrer, c.country
    from public.block_clicks c
    join public.blocks b on b.id = c.block_id
    where b.user_id = p_user_id
      and (p_cutoff is null or c.clicked_at >= p_cutoff)
  ),
  domains as (
    select case
      when referrer is null or position('://' in referrer) = 0 then 'Direct'
      else lower(regexp_replace(split_part(split_part(referrer, '://', 2), '/', 1), '^www\.', ''))
    end as domain
    from owned
  ),
  top_referrers as (
    select domain, count(*)::int as clicks
    from domains
    group by domain
    order by clicks desc, domain asc
    limit 8
  ),
  top_countries as (
    select coalesce(country, 'Unknown') as country, count(*)::int as clicks
    from owned
    group by 1
    order by clicks desc, country asc
    limit 8
  )
  select jsonb_build_object(
    'total_clicks', (select count(*) from owned),
    'referrers', coalesce(
      (select jsonb_agg(jsonb_build_object('domain', domain, 'clicks', clicks) order by clicks desc, domain asc) from top_referrers),
      '[]'::jsonb
    ),
    'countries', coalesce(
      (select jsonb_agg(jsonb_build_object('country', country, 'clicks', clicks) order by clicks desc, country asc) from top_countries),
      '[]'::jsonb
    )
  );
$$;

grant execute on function public.get_click_stats(uuid, timestamptz) to service_role;
