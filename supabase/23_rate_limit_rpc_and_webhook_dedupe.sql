-- ============================================================
-- STEP 23 — Atomic rate limiting + Twitch webhook dedupe
--
-- (a) `rate_limit_hit` collapses the limiter's read→upsert→sum sequence
--     (3 round trips, racy under burst: concurrent callers read the same
--     count and both write count+1, undercounting) into one atomic
--     INSERT ... ON CONFLICT ... DO UPDATE plus the window sum — a single
--     round trip on the hot /r/{id} redirect path.
--
-- (b) `twitch_webhook_messages` records processed EventSub message ids.
--     Twitch retries notifications; without dedupe a retried stream.online
--     re-runs its side effects. Rows older than a day are pruned by the
--     daily cron (the replay guard already rejects messages > 10 min old).
-- ============================================================

create or replace function public.rate_limit_hit(
  p_scope text,
  p_key text,
  p_window_start timestamptz,
  p_cutoff timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used bigint;
  v_oldest timestamptz;
begin
  insert into public.rate_limit_buckets as b (scope, key, window_start, count)
  values (p_scope, p_key, p_window_start, 1)
  on conflict (scope, key, window_start)
  do update set count = b.count + 1;

  select coalesce(sum(count), 0), min(window_start)
    into v_used, v_oldest
  from public.rate_limit_buckets
  where scope = p_scope and key = p_key and window_start >= p_cutoff;

  return jsonb_build_object('used', v_used, 'oldest', v_oldest);
end;
$$;

grant execute on function public.rate_limit_hit(text, text, timestamptz, timestamptz) to service_role;

create table if not exists public.twitch_webhook_messages (
  id text primary key,
  received_at timestamptz default now() not null
);

create index if not exists twitch_webhook_messages_received_idx
  on public.twitch_webhook_messages (received_at);

grant all privileges on public.twitch_webhook_messages to service_role;
